# Contributing to OpenVoice Studio

We welcome contributions from speech AI researchers, audio engineers, and software developers!

## Contribution Standards

1. **No Proprietary Cloud Dependencies**: All features, models, and adapters must run entirely locally without requiring paid cloud APIs or token credits.
2. **Strict Licensing & Provenance**: New voice additions must cite their underlying training corpus and confirm permissive redistribution rights (Apache 2.0, MIT, BSD, CC-BY, CC0).
3. **No Fake Controls**: If an inference model does not support a parameter (e.g. pitch or emotion), do not present a non-functional slider in the UI without real DSP support.
4. **Biometric Ethics**: Voice cloning tools must maintain consent verification and safeguard against unauthorized impersonation.

## Development Workflow

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/new-model-adapter
   ```
2. Implement your changes and write unit tests in `backend/tests/`.
3. Run automated tests:
   ```bash
   node backend/tests/direct_test.js
   ```
4. Submit a Pull Request with a clear description and benchmark metrics.
