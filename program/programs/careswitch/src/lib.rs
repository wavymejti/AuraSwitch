pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("CmMRpxgNfSqx69y3tXV4hvVkh7RztYK5Et1SrycikQM7");

#[program]
pub mod careswitch {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        vault_id: u64,
        beneficiary: Pubkey,
        heartbeat_key: Pubkey,
        timeout_secs: i64,
    ) -> Result<()> {
        instructions::initialize::handle_initialize(
            ctx,
            vault_id,
            beneficiary,
            heartbeat_key,
            timeout_secs,
        )
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handle_deposit(ctx, amount)
    }

    pub fn ping(ctx: Context<Ping>) -> Result<()> {
        instructions::ping::handle_ping(ctx)
    }

    pub fn release_to_beneficiary(ctx: Context<ReleaseToBeneficiary>) -> Result<()> {
        instructions::release_to_beneficiary::handle_release_to_beneficiary(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handle_withdraw(ctx, amount)
    }
}
