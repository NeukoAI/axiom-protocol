use anchor_lang::prelude::*;

declare_id!("EXrW7f72Ymayz9yR2oWrNxNMV6PbMvCjPUL53kgdp6hE");

#[program]
pub mod axiom_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
