# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-27

### Added

- `SmartObject(schema)` factory: typed getters and `set*` methods generated from a Zod object schema
- RFC 6902 operation log (`operations`) for every validated change
- `clearOperations()` to reset the audit trail without rolling back state
- `fromOperations(initial, operations)` static method for deterministic replay
- Exported types: `Operation`, `SetMethods`, `OperationsAccessor`, `SmartObjectConstructor`, `SmartObjectInstance`

[1.0.0]: https://github.com/gialicus/smart-object/releases/tag/v1.0.0
