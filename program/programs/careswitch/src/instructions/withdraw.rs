use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::CareError,
    state::{CareVault, Status},
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [CARE_SEED, vault.owner.as_ref(), &vault.vault_id.to_le_bytes()],
        bump = vault.bump,
        has_one = owner @ CareError::NotAuthorized
    )]
    pub vault: Account<'info, CareVault>,
}

pub fn handle_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &ctx.accounts.vault;

    require!(vault.status == Status::Active, CareError::NotActive);

    vault.send_lamports(
        &vault.to_account_info(),
        &ctx.accounts.owner.to_account_info(),
        amount,
    )?;

    msg!("Owner withdrew {} lamports", amount);
    Ok(())
}
