//! Solder Cortex Integration for SOLPRISM
//!
//! Adds conviction scoring to enhance agent reasoning verification.
//! Before trusting an agent's reasoning proof, verify their wallet has
//! cross-domain conviction (active in DeFi + prediction markets).
//!
//! Demo: http://76.13.193.103/
//! GitHub: https://github.com/metalmcclaw/solder-cortex

use serde::{Deserialize, Serialize};

const CORTEX_API: &str = "http://76.13.193.103/api";

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvictionScore {
    pub wallet: String,
    pub score: f64,
    pub defi_activity: f64,
    pub prediction_market_activity: f64,
    pub cross_domain_correlation: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrustAssessment {
    pub trust_level: TrustLevel,
    pub conviction: Option<ConvictionScore>,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum TrustLevel {
    High,
    Medium,
    Low,
}

/// Fetch conviction score for a wallet
pub async fn get_wallet_conviction(wallet: &str) -> Result<ConvictionScore, String> {
    let url = format!("{}/conviction/{}", CORTEX_API, wallet);
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }
    
    response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Assess trust in an agent's reasoning proof using conviction data
/// Agents with high conviction have demonstrated skin in the game
pub async fn assess_reasoning_trust(wallet: &str) -> TrustAssessment {
    match get_wallet_conviction(wallet).await {
        Ok(conviction) => {
            let trust_level = if conviction.score >= 0.8 {
                TrustLevel::High
            } else if conviction.score >= 0.4 {
                TrustLevel::Medium
            } else {
                TrustLevel::Low
            };
            
            TrustAssessment {
                trust_level,
                reason: format!(
                    "Conviction score: {:.2} (DeFi: {:.2}, Prediction: {:.2})",
                    conviction.score,
                    conviction.defi_activity,
                    conviction.prediction_market_activity
                ),
                conviction: Some(conviction),
            }
        }
        Err(e) => TrustAssessment {
            trust_level: TrustLevel::Medium,
            conviction: None,
            reason: format!("Could not fetch conviction: {}", e),
        },
    }
}
