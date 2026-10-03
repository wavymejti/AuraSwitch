use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::CareError,
    state::{CareVault, Status},
};

#[derive(Accounts)]
pub struct Pay<'info> {
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        seeds = [CARE_SEED, vault.owner.as_ref(), &vault.vault_id.to_le_bytes()],
        bump = vault.bump,
        has_one = beneficiary @ CareError::NotAuthorized
    )]
    pub vault: Account<'info, CareVault>,

    /// CHECK: verified against the vault allowlist in the handler
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}

pub fn handle_pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let recipient = &ctx.accounts.recipient;

    require!(vault.status == Status::Takeover, CareError::NotInTakeover);
    require!(
        vault.allowlist.contains(recipient.key),
        CareError::RecipientNotAllowed
    );

    vault.send_lamports(
        &vault.to_account_info(),
        &recipient.to_account_info(),
        amount,
    )?;

    msg!("Paid {} lamports to {}", amount, recipient.key());
    Ok(())
}
