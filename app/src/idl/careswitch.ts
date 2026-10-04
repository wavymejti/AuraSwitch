/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/careswitch.json`.
 */
export type Careswitch = {
  "address": "CmMRpxgNfSqx69y3tXV4hvVkh7RztYK5Et1SrycikQM7",
  "metadata": {
    "name": "careswitch",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "CareSwitch – caregiver fund with on-chain dead man's switch"
  },
  "instructions": [
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "careVault"
              },
              {
                "kind": "account",
                "path": "vault.vaultId",
                "account": "careVault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "vaultId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaultId",
          "type": "u64"
        },
        {
          "name": "beneficiary",
          "type": "pubkey"
        },
        {
          "name": "heartbeatKey",
          "type": "pubkey"
        },
        {
          "name": "timeoutSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "ping",
      "discriminator": [
        173,
        0,
        94,
        236,
        73,
        133,
        225,
        153
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "careVault"
              },
              {
                "kind": "account",
                "path": "vault.vaultId",
                "account": "careVault"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "releaseToBeneficiary",
      "discriminator": [
        181,
        247,
        242,
        92,
        139,
        175,
        156,
        65
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "careVault"
              },
              {
                "kind": "account",
                "path": "vault.vaultId",
                "account": "careVault"
              }
            ]
          }
        },
        {
          "name": "beneficiary",
          "writable": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "careVault"
              },
              {
                "kind": "account",
                "path": "vault.vaultId",
                "account": "careVault"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "careVault",
      "discriminator": [
        113,
        4,
        195,
        237,
        106,
        177,
        195,
        143
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notAuthorized",
      "msg": "Signer is not allowed to perform this action"
    },
    {
      "code": 6001,
      "name": "notExpired",
      "msg": "Heartbeat timeout has not expired yet"
    },
    {
      "code": 6002,
      "name": "notActive",
      "msg": "Vault is not active"
    },
    {
      "code": 6003,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in the vault"
    },
    {
      "code": 6004,
      "name": "invalidConfig",
      "msg": "Invalid vault configuration"
    }
  ],
  "types": [
    {
      "name": "careVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Primary caregiver (A)"
            ],
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "docs": [
              "Substitute caregiver (B), receives the funds after the timeout; offset 40 – used by",
              "the UI to find vaults by beneficiary"
            ],
            "type": "pubkey"
          },
          {
            "name": "heartbeatKey",
            "docs": [
              "Device key – may only ping while Active; offset 72"
            ],
            "type": "pubkey"
          },
          {
            "name": "timeoutSecs",
            "type": "i64"
          },
          {
            "name": "lastHeartbeat",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "status"
              }
            }
          },
          {
            "name": "allowlist",
            "docs": [
              "Unused since funds go straight to the beneficiary; kept (empty) so the account",
              "layout of existing vaults stays readable."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "vaultId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "status",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "takeover"
          },
          {
            "name": "released"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "careSeed",
      "type": "bytes",
      "value": "[99, 97, 114, 101]"
    }
  ]
};
