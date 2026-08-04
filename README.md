# Iraq University Guide

A student-guidance platform for Iraqi high school graduates. It combines a RIASEC personality assessment with real, research-backed data on university majors, admission cutoffs, and tuition fees to help students choose the right major and university.

## Features

- **RIASEC Personality Test** - helps students discover which academic fields fit their personality type.
- **Major & University Matching** - recommends majors based on test results and real acceptance cutoffs.
- **Official Admission Data** - cutoff scores are extracted and validated from official Ministry of Higher Education PDF documents for the 2025-2026 academic year.
- **Private University Info** - includes department listings and tuition details for private universities.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Vitest (unit testing)
- ESLint & Prettier (code quality/formatting)
- Node.js scripts for PDF parsing and data pipeline generation

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```
git clone https://github.com/mkhald357-star/iraq-university-guide.git
cd iraq-university-guide
npm install
```

### Running Locally

```
npm run dev
```

The app will be available at http://localhost:3000.

### Build for Production

```
npm run build
npm run start
```

### Testing

```
npm run test
```

### Linting & Formatting

```
npm run lint
npm run format
```

## Data Pipeline

This project includes scripts to rebuild university and major data from official source PDFs:

```
npm run rebuild-data
```

This runs PDF text extraction, cutoff parsing, and university/major dataset generation in sequence.

## Project Structure

```
app/       -> Next.js application routes and pages
data/      -> Processed datasets (universities, majors, cutoffs)
lib/       -> Shared utilities and business logic
public/    -> Static assets
scripts/   -> Data processing and build scripts
reports/   -> Project analysis and planning documents
```

## Contributing

This is currently a solo project. Contribution guidelines will be added in the future.

## License

No license has been specified yet.
