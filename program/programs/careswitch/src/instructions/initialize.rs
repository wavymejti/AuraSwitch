use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::CareError,
    state::{CareVault, Status},
};

#[derive(Accounts)]
#[instruction(vault_id: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + CareVault::INIT_SPACE,
        seeds = [CARE_SEED, owner.key().as_ref(), &vault_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, CareVault>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(
    ctx: Context<Initialize>,
    vault_id: u64,
    beneficiary: Pubkey,
    heartbeat_key: Pubkey,
    timeout_secs: i64,
) -> Result<()> {
    let owner = ctx.accounts.owner.key();

    require!(timeout_secs > 0, CareError::InvalidConfig);
    // Releasing to yourself would make the switch pointless.
    require!(beneficiary != owner, CareError::InvalidConfig);

    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.vault.set_inner(CareVault {
        owner,
        beneficiary,
        heartbeat_key,
        timeout_secs,
        last_heartbeat: now,
        status: Status::Active,
        allowlist: Vec::new(),
        vault_id,
        bump: ctx.bumps.vault,
    });

    msg!("CareVault {} created, timeout {}s", vault_id, timeout_secs);
    Ok(())
}
