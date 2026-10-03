use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::CareError,
    state::{CareVault, Status},
};

/// Permissionless: Solana has no cron, so anyone may flip the switch –
/// the clock alone decides whether it is allowed.
#[derive(Accounts)]
pub struct ActivateTakeover<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [CARE_SEED, vault.owner.as_ref(), &vault.vault_id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, CareVault>,
}

pub fn handle_activate_takeover(ctx: Context<ActivateTakeover>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let now = Clock::get()?.unix_timestamp;

    require!(vault.status == Status::Active, CareError::NotActive);
    require!(
        now - vault.last_heartbeat > vault.timeout_secs,
        CareError::NotExpired
    );

    vault.status = Status::Takeover;
    msg!(
        "Takeover activated at {} by {}",
        now,
        ctx.accounts.caller.key()
    );
    Ok(())
}
