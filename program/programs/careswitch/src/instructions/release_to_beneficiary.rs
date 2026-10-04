use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::CareError,
    state::{CareVault, Status},
};

/// Permissionless: Solana has no cron, so anyone (in practice the presence agent)
/// sends this once the timeout passes – the clock alone decides whether it's allowed,
/// and the funds can only go to the beneficiary stored in the vault.
#[derive(Accounts)]
pub struct ReleaseToBeneficiary<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [CARE_SEED, vault.owner.as_ref(), &vault.vault_id.to_le_bytes()],
        bump = vault.bump,
        has_one = beneficiary @ CareError::NotAuthorized
    )]
    pub vault: Account<'info, CareVault>,

    /// CHECK: must equal `vault.beneficiary` (enforced by `has_one`)
    #[account(mut)]
    pub beneficiary: UncheckedAccount<'info>,
}

pub fn handle_release_to_beneficiary(ctx: Context<ReleaseToBeneficiary>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let now = Clock::get()?.unix_timestamp;

    require!(vault.status == Status::Active, CareError::NotActive);
    require!(
        now - vault.last_heartbeat > vault.timeout_secs,
        CareError::NotExpired
    );

    let vault_info = vault.to_account_info();
    let amount = vault.available_lamports(&vault_info)?;
    if amount > 0 {
        vault.send_lamports(&vault_info, &ctx.accounts.beneficiary.to_account_info(), amount)?;
    }

    ctx.accounts.vault.status = Status::Released;
    msg!(
        "Released {} lamports to {} at {} (called by {})",
        amount,
        ctx.accounts.beneficiary.key(),
        now,
        ctx.accounts.caller.key()
    );
    Ok(())
}
