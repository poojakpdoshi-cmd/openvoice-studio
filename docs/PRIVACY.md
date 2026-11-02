# OpenVoice Studio — Privacy Policy & Biometric Consent Framework

## 1. Local-First Privacy Architecture

OpenVoice Studio is designed around the core principle of **Absolute Data Sovereignty**:
- **Zero Cloud Leakage**: All audio recordings, generated waveforms, custom voice cloning embeddings, and text inputs remain strictly on the user's local machine.
- **No Telemetry or Tracking**: No analytics, phone-home beacons, or user tracking are built into OpenVoice Studio.
- **Local SQLite Storage**: Project metadata, generation histories, and custom voice models are stored in `storage/openvoice.db` and cannot be accessed remotely without explicit local filesystem access.

---

## 2. Personal Voice Cloning & Biometric Consent Protocol

Voice cloning technology has significant ethical implications. OpenVoice Studio enforces strict safeguards before any voice cloning operation can occur:

### 2.1 Mandatory Consent Verification
Prior to processing reference audio for custom voice profile generation, the user must explicitly confirm:
1. **Ownership / Authorized Consent**: The user must declare that either:
   - The voice recording is of their own physical voice, OR
   - The user has obtained explicit, documented, and legally binding authorization from the voice subject.
2. **Non-Malicious Use Agreement**: The user commits to never use the synthesized voice profile to:
   - Defraud, mislead, or impersonate another person without disclosure.
   - Bypass biometric voice authentication or telephonic verification systems.
   - Generate defamatory, non-consensual sexual, or fraudulent material.

The system records a permanent, cryptographically timestamped consent record in the local database:
```json
{
  "voice_id": "custom-uuid-v4",
  "consent_confirmed": true,
  "consent_timestamp": "2026-11-02T22:45:00Z",
  "disclaimer_version": "1.0",
  "client_ip": "127.0.0.1",
  "consent_checksum": "sha256-hash-of-user-affirmation"
}
```

### 2.2 Private-by-Default Policy
* Custom voice profiles are marked `is_custom = 1` and `is_private = 1`.
* Custom profiles are never uploaded to any central registry or shared across network boundaries.
* Export of custom voice profiles requires an explicit user action and packages only local embedding tensors with an embedded ethics warning.

### 2.3 Clear Data Deletion (Right to Erasure)
When a user deletes a custom voice profile:
1. The voice record and metadata are purged from SQLite.
2. The reference audio recording file (`.wav`) is deleted from disk.
3. All derived acoustic features, embeddings, and latent representations are completely unlinked and wiped from storage.
4. Any cached generation files associated with that custom voice are offered for purge.

