use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::CareError,
    state::{CareVault, Status},
};

#[derive(Accounts)]
pub struct Ping<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [CARE_SEED, vault.owner.as_ref(), &vault.vault_id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, CareVault>,
}

pub fn handle_ping(ctx: Context<Ping>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let signer = ctx.accounts.signer.key();

    if signer == vault.owner {
        // A is back – reactivates a released (now empty) vault so it can be refilled.
        if vault.status != Status::Active {
            msg!("Owner returned, vault active again");
        }
        vault.status = Status::Active;
    } else if signer == vault.heartbeat_key {
        // The device key can only keep an active vault alive.
        require!(vault.status == Status::Active, CareError::NotActive);
    } else {
        return err!(CareError::NotAuthorized);
    }

    vault.last_heartbeat = Clock::get()?.unix_timestamp;
    msg!("Heartbeat at {}", vault.last_heartbeat);
    Ok(())
}
