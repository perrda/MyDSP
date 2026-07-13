# MyDSP Changelog

## [0.8.0] - 2026-07-13

### Phase 3: Documentation & Utilities

#### Developer Documentation
- Comprehensive 500+ line developer guide (DEVELOPER_DOCS.md)
- Architecture overview with directory structure
- Domain logic patterns and examples
- Data validation usage guide
- Search & filtering documentation
- Caching strategy documentation
- API integration examples
- Testing guide with examples
- Performance optimization checklist
- Best practices and common patterns
- FAQ section

#### Utility Functions Library
- 80+ utility functions in helpers.ts
- **Date utilities**: formatDate, addDays, addMonths, diffDays, diffMonths, isToday, isThisWeek, isThisMonth
- **Number utilities**: clamp, round, percentage, average, median, sum, min, max, randomInt, randomFloat
- **String utilities**: capitalize, titleCase, truncate, slugify, pluralize, initials, removeHtmlTags, escapeHtml
- **Array utilities**: unique, groupBy, sortBy, chunk, shuffle, sample, partition
- **Object utilities**: pick, omit, deepClone, isEmpty, deepEqual
- **Async utilities**: sleep, retry with backoff, timeout
- **LocalStorage utilities**: setItem, getItem, removeItem, clearStorage
- **Color utilities**: hexToRgb, rgbToHex
- **File utilities**: formatFileSize, getFileExtension
- **URL utilities**: parseQueryString, buildQueryString
- **Performance utilities**: measure, measureAsync

### Technical Improvements
- All utilities fully typed with TypeScript
- No external dependencies
- Tree-shakeable exports
- JSDoc comments for IntelliSense
- Production-ready code quality

---

## [0.7.0] - 2026-07-13

### Major Features Added

#### Enhanced CSV Import with Auto-Mapping
- Automatic bank format detection for 9 major UK banks
- Smart column mapping with fallback
- 3-step import wizard
- Import statistics with duplicate detection

#### Advanced Analytics & Predictive Forecasting
- Financial Health Score (0-100)
- Net Worth Forecasting (12 months)
- Category Spending Trend Analysis
- Anomaly Detection (Z-score)
- Savings Rate Trend tracking

#### API Export & Automation Foundations
- Standard API response format (JSON)
- Portfolio, Spending, Goals, Budget exports
- CSV export for Excel/Sheets
- Documented API endpoints
- Webhook framework

#### Smart Insights with Pattern Recognition
- Recurring Pattern Detection
- Smart Suggestions
- Category Correction Suggestions
- Merchant Clustering

#### UI Polish
- Bottom navigation for iPhone
- Pull-to-refresh gesture
- Device detection utilities
- Touch optimizations (44px targets)
- iOS-specific improvements

#### Backend Utilities
- Enhanced data validation (400+ lines)
- Advanced search & filtering (550+ lines)
- Background calculations & caching (400+ lines)

---

## [0.6.3] - 2026-07-12

### Features Added
- Social Features
- Accessibility (WCAG 2.1 AA)
- Quick Wins: Budgeting 2.0, Smart Reminders, Advanced Charts

---

## Previous Versions
See git history for earlier changes.

