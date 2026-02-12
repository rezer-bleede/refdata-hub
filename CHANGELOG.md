# Changelog

All notable changes to RefData Hub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- [ ] Role-based access control (RBAC)
- [ ] Authentication (JWT, OAuth)
- [ ] Webhook notifications
- [ ] Advanced matching with custom models
- [ ] Multi-language support
- [ ] Real-time sync to downstream systems

### Bug Fixes
- [ ] List planned bug fixes here

## [0.1.0] - 2024-XX-XX

### Added
- Initial release of RefData Hub
- Semantic matching with TF-IDF embeddings
- LLM-based matching with OpenAI and Ollama support
- Canonical library management
- Dimension catalog with custom attribute schemas
- Dimension relations (parent/child hierarchies)
- Source system connections
- Field mappings to reference dimensions
- Match insights and analytics
- Bulk import/export (CSV, TSV, Excel)
- Modern React reviewer UI with Tailwind CSS
- Docker Compose multi-service setup
- API documentation with OpenAPI/Swagger

### Features
- Multi-theme support (dark, light, midnight)
- Collapsible navigation rail
- Connection testing for source systems
- Inline semantic suggestions for unmatched values
- Automatic sample capture from source systems
- Match rate visualization per mapping
- Configurable matcher thresholds
- Dimension detail views with coverage metrics

### Security
- CORS configuration
- SQL injection prevention (SQLAlchemy)
- Environment variable based configuration
- (Production only) Encrypted API key storage

### Documentation
- Comprehensive README with quickstart
- API reference documentation
- Architecture and design documentation
- Developer guide
- Database schema documentation
- Deployment guide
- Configuration reference
- Testing guide
- Contributing guidelines

### Testing
- Backend unit and integration tests (pytest)
- Frontend component tests (Vitest)
- API endpoint tests
- Matcher algorithm tests
- Database migration tests
- Reviewer UI deployment tests

---

## Version History Format

Each version section includes:

### Added
- New features
- New capabilities
- New API endpoints

### Changed
- Changes in existing functionality
- Performance improvements
- Code refactoring

### Deprecated
- Features that will be removed in future versions

### Removed
- Features removed in this version

### Fixed
- Bug fixes
- Security fixes

### Security
- Security improvements
- Vulnerability fixes

### Documentation
- Documentation updates
- New guides

### Testing
- Test improvements
- New test coverage

---

## Release Checklist

Before releasing a new version:

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers updated in:
  - [ ] `api/app/main.py`
  - [ ] `reviewer-ui/package.json`
  - [ ] `README.md`
- [ ] Git tag created
- [ ] Release notes drafted
- [ ] Deployment tested

---

## Upgrade Guide

### From 0.0.x to 0.1.0

No breaking changes. Database schema is automatically created/updated on startup.

### Future Upgrades

Check this section for important upgrade notes between versions.
