use anchor_lang::prelude::*;

#[error_code]
pub enum CareError {
    #[msg("Signer is not allowed to perform this action")]
    NotAuthorized,
    #[msg("Heartbeat timeout has not expired yet")]
    NotExpired,
    #[msg("Vault is not in takeover mode")]
    NotInTakeover,
    #[msg("Vault is not active")]
    NotActive,
    #[msg("Recipient is not on the allowlist")]
    RecipientNotAllowed,
    #[msg("Insufficient funds in the vault")]
    InsufficientFunds,
    #[msg("Invalid vault configuration")]
    InvalidConfig,
}
