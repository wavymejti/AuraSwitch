use anchor_lang::prelude::*;

use crate::{error::CareError, MAX_ALLOWLIST};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Status {
    Active,
    /// Legacy state from the allowlist version (no longer entered); owner ping restores Active.
    Takeover,
    /// Timeout passed and the whole available balance went to the beneficiary.
    Released,
}

#[account]
#[derive(InitSpace)]
pub struct CareVault {
    /// Primary caregiver (A)
    pub owner: Pubkey,
    /// Substitute caregiver (B), receives the funds after the timeout; offset 40 – used by
    /// the UI to find vaults by beneficiary
    pub beneficiary: Pubkey,
    /// Device key – may only ping while Active; offset 72
    pub heartbeat_key: Pubkey,
    pub timeout_secs: i64,
    pub last_heartbeat: i64,
    pub status: Status,
    /// Unused since funds go straight to the beneficiary; kept (empty) so the account
    /// layout of existing vaults stays readable.
    #[max_len(MAX_ALLOWLIST)]
    pub allowlist: Vec<Pubkey>,
    pub vault_id: u64,
    pub bump: u8,
}

impl CareVault {
    /// Lamports that can leave the vault without dropping it below rent exemption.
    pub fn available_lamports(&self, info: &AccountInfo) -> Result<u64> {
        let rent_min = Rent::get()?.minimum_balance(info.data_len());
        Ok(info.lamports().saturating_sub(rent_min))
    }

    /// Moves lamports out of the program-owned PDA. System Program can't debit
    /// an account it doesn't own, so lamports are moved directly.
    pub fn send_lamports<'info>(
        &self,
        vault: &AccountInfo<'info>,
        to: &AccountInfo<'info>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, CareError::InvalidConfig);
        require!(
            amount <= self.available_lamports(vault)?,
            CareError::InsufficientFunds
        );
        **vault.try_borrow_mut_lamports()? -= amount;
        **to.try_borrow_mut_lamports()? += amount;
        Ok(())
    }
}
