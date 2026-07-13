# MyDSP Changelog

## [0.9.0] - 2026-07-13

### Phase 4: Advanced Backend Infrastructure

#### Mathematical & Statistical Utilities (`advancedMath.ts`)
- **Statistical Functions**: mean, median, mode, variance, standard deviation, coefficient of variation, skewness, kurtosis
- **Correlation & Regression**: covariance, correlation, linear regression, polynomial regression
- **Exponential Smoothing**: single and double exponential smoothing
- **Moving Averages**: simple, exponential, and weighted moving averages
- **Percentiles & Quartiles**: percentile calculation, quartile analysis, IQR
- **Financial Calculations**: CAGR, Sharpe ratio, max drawdown, volatility, beta
- **Value at Risk**: VaR, Conditional VaR (CVaR)
- **Time Series**: autocorrelation, trend detection, seasonality detection
- **Outlier Detection**: IQR and Z-score methods
- **Normalization**: min-max and z-score normalization

#### Data Export Enhancements (`exportFormats.ts`)
- **PDF Generation**: HTML-to-PDF ready templates
- Transaction reports with summary cards
- Spending analysis with category breakdowns
- Goals reports with active/expired filtering
- Print-friendly styling
- **Excel/CSV Export**: Enhanced CSV with cell formatting
- Transactions, Spending, Goals, Jobs, Todos to Excel
- Custom formatting (colors, bold, backgrounds)
- **Download Helpers**: One-click download for PDF/Excel
- Print helpers for instant printing

#### Security & Encryption (`security.ts`)
- **Hashing**: SHA-256 and SHA-512
- **Encryption**: AES-GCM with PBKDF2 key derivation
- Encrypt/decrypt with password protection
- **Data Sanitization**: HTML sanitization, SQL injection prevention, XSS detection
- Filename sanitization
- **Input Validation**: Email, URL, UK phone numbers, UK postcodes
- **Token Generation**: Random tokens, UUID, OTP generation
- **Password Strength**: Password scoring with feedback
- **Rate Limiting**: Token bucket algorithm
- **CSRF Protection**: Token generation and validation
- **Audit Logging**: Comprehensive audit trail
- **Secure Storage**: Encrypted localStorage
- **Data Masking**: Email, phone, card number, NINO masking

#### Data Cleanup & Maintenance (`dataCleanup.ts`)
- **Automated Cleanup**: Portfolio, spending, goals, todos, jobs
- Remove old data with configurable retention
- Duplicate detection and removal
- History compaction
- **Duplicate Detection**: Smart similarity matching
- Levenshtein distance for fuzzy matching
- **Data Optimization**: LocalStorage cleanup
- Cache expiry management
- **Validation & Repair**: Data validation with issue detection
- Automatic data repair for common issues
- **Scheduled Cleanup**: Configurable cleanup schedules

#### Performance Profiling (`performance.ts`)
- **Performance Marks & Measures**: Custom timing marks
- **Function Profiling**: Profile sync and async functions
- Call counts, avg/min/max times
- **Render Profiling**: Track component render times
- **Network Profiling**: Track API requests and metrics
- **Bundle Size Analysis**: Analyze scripts and stylesheets
- **Memory Leak Detection**: Heap snapshots
- Memory trend analysis
- **FPS Monitoring**: Real-time FPS tracking
- **Long Tasks Detection**: Identify slow operations (>50ms)
- **Comprehensive Reports**: Export full performance data
- **Auto Monitoring**: Background monitoring mode

#### Advanced Filtering (`filtering.ts`)
- **Filter Operators**: 17 operators (equals, contains, greater_than, between, in, regex, etc.)
- **Preset Filters**: 25+ presets for Spending, Goals, Todos, Jobs
- High value, last 7 days, this month, subscriptions, etc.
- **Filter Engine**: Apply complex multi-condition filters
- **Sort Engine**: Multi-field sorting with direction
- **Filter Builder**: Fluent API for custom filters
- **Filter Persistence**: Save and load filter history

#### Data Transformations (`transformations.ts`)
- **Pipeline Builder**: Chainable transformation pipelines
- **Common Transforms**: Map, filter, rename, omit, add fields
- Transform specific fields
- **Aggregation**: Group by, aggregate functions
- **Spending Transforms**: Category normalization, data enrichment
- Amount categorization
- **Portfolio Transforms**: Flatten nested data structures
- **Export Transforms**: CSV row generation, JSON export
- **Validation**: Validate and clean with defaults
- **Batch Operations**: Process large datasets in batches
- Async batch processing with concurrency

#### Notification System (`notifications.ts`)
- **Notification Manager**: Full notification lifecycle management
- **Priority Levels**: Low, medium, high, critical
- **Types**: Info, success, warning, error, reminder, achievement
- **Desktop Notifications**: Native browser notifications
- **Quiet Hours**: Configurable quiet hours
- **Smart Rules**: Conditional notification triggers
- Budget warnings, credit utilization alerts
- Goal deadline reminders
- **Cooldown Logic**: Prevent notification spam

#### Batch Operations (`batchOperations.ts`)
- **Batch Processor**: Create, update, delete in bulk
- **Bulk Operations**: bulkCreate, bulkUpdate, bulkDelete
- **Transaction Support**: ACID-like transactions with rollback
- **Parallel Processing**: Process with concurrency control
- **Progress Tracking**: Real-time progress callbacks
- **Error Handling**: Retry logic with exponential backoff
- **Dry Run Mode**: Test operations without execution

### Technical Improvements
- All utilities fully typed with TypeScript
- Zero external dependencies for new features
- Extensive JSDoc documentation
- Production-ready error handling
- Comprehensive unit test coverage ready

### Performance Enhancements
- Optimized batch processing
- Efficient data transformations
- Memory-safe large dataset handling
- Incremental calculation support

---

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

