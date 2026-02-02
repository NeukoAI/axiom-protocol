use anchor_lang::prelude::*;

declare_id!("AxioMvAR1a1ArhEn7Fogy6cFHeRZ5Ucy4bFoXQVZ8888");

/// AXIOM Protocol — Verifiable AI Reasoning on Solana
/// 
/// Agents commit hashes of their reasoning before executing actions.
/// Anyone can verify the reasoning matches the on-chain commitment.
#[program]
pub mod axiom {
    use super::*;

    /// Register a new agent profile on AXIOM.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
    ) -> Result<()> {
        require!(name.len() <= 64, AxiomError::NameTooLong);
        require!(!name.is_empty(), AxiomError::NameEmpty);
        
        let profile = &mut ctx.accounts.agent_profile;
        profile.authority = ctx.accounts.authority.key();
        profile.name = name;
        profile.total_commitments = 0;
        profile.total_verified = 0;
        profile.accountability_score = 10000; // Start at 100.00% (basis points)
        profile.created_at = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.agent_profile;
        
        Ok(())
    }

    /// Commit a reasoning hash before executing an action.
    /// 
    /// The agent publishes the SHA-256 hash of their full reasoning trace.
    /// This must happen BEFORE the action is executed, creating a 
    /// tamper-proof record of the agent's decision-making process.
    pub fn commit_reasoning(
        ctx: Context<CommitReasoning>,
        commitment_hash: [u8; 32],
        action_type: String,
        confidence: u8,
        nonce: u64,
    ) -> Result<()> {
        require!(action_type.len() <= 32, AxiomError::ActionTypeTooLong);
        require!(confidence <= 100, AxiomError::InvalidConfidence);
        
        let commitment = &mut ctx.accounts.commitment;
        commitment.agent = ctx.accounts.agent_profile.key();
        commitment.authority = ctx.accounts.authority.key();
        commitment.commitment_hash = commitment_hash;
        commitment.action_type = action_type;
        commitment.confidence = confidence;
        commitment.timestamp = Clock::get()?.unix_timestamp;
        commitment.revealed = false;
        commitment.reasoning_uri = String::new();
        commitment.nonce = nonce;
        commitment.bump = ctx.bumps.commitment;
        
        // Increment agent's commitment count
        let profile = &mut ctx.accounts.agent_profile;
        profile.total_commitments = profile.total_commitments.checked_add(1)
            .ok_or(AxiomError::Overflow)?;
        
        emit!(ReasoningCommitted {
            agent: ctx.accounts.agent_profile.key(),
            commitment: ctx.accounts.commitment.key(),
            action_type: commitment.action_type.clone(),
            confidence,
            timestamp: commitment.timestamp,
        });
        
        Ok(())
    }

    /// Reveal the full reasoning by providing its storage URI.
    /// 
    /// After the action is executed, the agent publishes the full
    /// reasoning trace (e.g., to IPFS) and records the URI on-chain.
    /// Anyone can then fetch the reasoning and verify it matches
    /// the committed hash.
    pub fn reveal_reasoning(
        ctx: Context<RevealReasoning>,
        reasoning_uri: String,
    ) -> Result<()> {
        require!(reasoning_uri.len() <= 256, AxiomError::UriTooLong);
        require!(!reasoning_uri.is_empty(), AxiomError::UriEmpty);
        
        let commitment = &mut ctx.accounts.commitment;
        require!(!commitment.revealed, AxiomError::AlreadyRevealed);
        
        commitment.revealed = true;
        commitment.reasoning_uri = reasoning_uri.clone();
        
        // Increment verified count
        let profile = &mut ctx.accounts.agent_profile;
        profile.total_verified = profile.total_verified.checked_add(1)
            .ok_or(AxiomError::Overflow)?;
        
        emit!(ReasoningRevealed {
            agent: ctx.accounts.agent_profile.key(),
            commitment: ctx.accounts.commitment.key(),
            reasoning_uri,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

// ─── Account Structs ───────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct AgentProfile {
    /// The agent's authority (wallet that controls this profile)
    pub authority: Pubkey,
    /// Display name (max 64 chars)
    #[max_len(64)]
    pub name: String,
    /// Total reasoning commitments published
    pub total_commitments: u64,
    /// Total commitments that have been revealed
    pub total_verified: u64,
    /// Accountability score in basis points (0-10000 = 0%-100%)
    pub accountability_score: u16,
    /// When the agent registered
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReasoningCommitment {
    /// The agent profile this commitment belongs to
    pub agent: Pubkey,
    /// The authority that created this commitment
    pub authority: Pubkey,
    /// SHA-256 hash of the full reasoning trace
    pub commitment_hash: [u8; 32],
    /// Type of action (e.g., "trade", "audit", "rebalance")
    #[max_len(32)]
    pub action_type: String,
    /// Confidence score (0-100)
    pub confidence: u8,
    /// Unix timestamp when committed
    pub timestamp: i64,
    /// Whether the full reasoning has been revealed
    pub revealed: bool,
    /// URI to the full reasoning (IPFS, Arweave, etc.)
    #[max_len(256)]
    pub reasoning_uri: String,
    /// Nonce for unique PDA derivation (allows multiple commitments)
    pub nonce: u64,
    /// PDA bump
    pub bump: u8,
}

// ─── Instruction Contexts ──────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AgentProfile::INIT_SPACE,
        seeds = [b"agent", authority.key().as_ref()],
        bump
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(commitment_hash: [u8; 32], action_type: String, confidence: u8, nonce: u64)]
pub struct CommitReasoning<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ReasoningCommitment::INIT_SPACE,
        seeds = [
            b"commitment",
            agent_profile.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub commitment: Account<'info, ReasoningCommitment>,
    
    #[account(
        mut,
        seeds = [b"agent", authority.key().as_ref()],
        bump = agent_profile.bump,
        has_one = authority
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealReasoning<'info> {
    #[account(
        mut,
        has_one = authority,
        constraint = commitment.agent == agent_profile.key() @ AxiomError::AgentMismatch
    )]
    pub commitment: Account<'info, ReasoningCommitment>,
    
    #[account(
        mut,
        seeds = [b"agent", authority.key().as_ref()],
        bump = agent_profile.bump,
        has_one = authority
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    
    pub authority: Signer<'info>,
}

// ─── Events ────────────────────────────────────────────────────────────────

#[event]
pub struct ReasoningCommitted {
    pub agent: Pubkey,
    pub commitment: Pubkey,
    pub action_type: String,
    pub confidence: u8,
    pub timestamp: i64,
}

#[event]
pub struct ReasoningRevealed {
    pub agent: Pubkey,
    pub commitment: Pubkey,
    pub reasoning_uri: String,
    pub timestamp: i64,
}

// ─── Errors ────────────────────────────────────────────────────────────────

#[error_code]
pub enum AxiomError {
    #[msg("Agent name must be 64 characters or less")]
    NameTooLong,
    #[msg("Agent name cannot be empty")]
    NameEmpty,
    #[msg("Action type must be 32 characters or less")]
    ActionTypeTooLong,
    #[msg("Confidence must be between 0 and 100")]
    InvalidConfidence,
    #[msg("Reasoning URI must be 256 characters or less")]
    UriTooLong,
    #[msg("Reasoning URI cannot be empty")]
    UriEmpty,
    #[msg("Reasoning has already been revealed")]
    AlreadyRevealed,
    #[msg("Agent profile does not match commitment")]
    AgentMismatch,
    #[msg("Arithmetic overflow")]
    Overflow,
}
