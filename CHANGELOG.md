# MyDSP Changelog

## [0.7.0] - 2026-07-13

### Major Features Added

#### Enhanced CSV Import with Auto-Mapping
- Automatic bank format detection for 9 major UK banks (Monzo, Revolut, Starling, HSBC, Barclays, Lloyds, Nationwide, Chase, Generic)
- Smart column mapping with fallback to generic format
- 3-step import wizard (Upload → Preview → Confirm)
- Import statistics with duplicate detection
- Support for separate debit/credit columns
- Data validation and error reporting

#### Advanced Analytics & Predictive Forecasting
- Financial Health Score (0-100) with 5 components
- Net Worth Forecasting with 12-month projections
- Category Spending Trend Analysis with volatility assessment
- Anomaly Detection using Z-score analysis
- Savings Rate Trend tracking
- Linear regression engine with R² confidence scoring

#### API Export & Automation Foundations
- Standard API response format (JSON)
- Portfolio Summary, Spending, Goals, and Budget exports
- CSV export for Excel/Google Sheets compatibility
- Documented API endpoints with examples
- Webhook framework (goal.completed, budget.exceeded, spending.anomaly, net_worth.milestone)
- Auto-generated API documentation

#### Smart Insights with Pattern Recognition
- Recurring Pattern Detection using statistical analysis
- Smart Suggestions (recurring transactions, budgets, goals)
- Category Correction Suggestions with confidence scores
- Merchant Clustering using Levenshtein distance
- One-click recategorization
- Priority-based suggestion sorting

### Technical Improvements
- Full TypeScript type safety throughout
- No external dependencies for ML features
- Efficient algorithms for large datasets
- Memoized calculations for performance
- Statistical utilities (mean, standard deviation, coefficient of variation)

### Bug Fixes
- Fixed TypeScript compilation errors
- Improved error handling for file operations
- Better data validation for imports

---

## [0.6.3] - 2026-07-12

### Features Added
- Social Features - Sharing and collaboration
- Accessibility - WCAG 2.1 AA compliance
- Quick Wins: Budgeting 2.0, Smart Reminders, Advanced Charts, Export & Reporting

### Improvements
- Mobile-first UI/UX redesign
- iOS-native aesthetics
- Enhanced touch targets and spacing
- Improved theme transitions

---

## Previous Versions
See git history for earlier changes.
