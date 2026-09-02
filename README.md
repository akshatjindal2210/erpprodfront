# IMP-App Frontend

**Current release:** [v3.4.38](./readme/version-notes/v3.4.38.md) — CL Task Report · Tasks stat cards · Not Viewed fix · Holiday import  
**All release notes:** [version-notes/README.md](./readme/version-notes/README.md)

This is the frontend of the IMP-App, built with Next.js 16, React 19, and Tailwind CSS 4. It follows a feature-based architecture for better scalability and maintainability.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/) with [Redux Persist](https://github.com/rt2zz/redux-persist)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Rich Text Editor**: [Tiptap](https://tiptap.dev/)
- **Real-time**: [Socket.io-client](https://socket.io/docs/v4/client-api/)
- **QR Scanning**: [html5-qrcode](https://github.com/mebjas/html5-qrcode)

## Project Structure

The project uses a feature-based architecture located in `src/`.

```text
src/
├── app/                  # Next.js App Router (Routes & Layouts)
│   ├── (auth)/           # Authentication routes
│   ├── home/             # Home page
│   ├── ims/              # IMS application routes
│   ├── task/             # Task application routes
│   └── settings/         # Global settings routes
├── config/               # Global configuration (registries, routes, theme)
├── core/                 # Core shared logic and components
│   ├── api/              # API client and endpoints
│   ├── components/       # Shared UI components, guards, and providers
│   ├── hooks/            # Global custom hooks
│   ├── layouts/          # Shared layout components (Navbar, Sidebar)
│   ├── store/            # Redux store and global slices
│   └── utils/            # Global utility functions
├── features/             # Feature-specific logic
│   ├── admin/            # Admin configuration and identity management
│   ├── apps/             # Main applications (IMS, Task)
│   └── shared/           # Shared features (Auth, Dashboard, Portal, PWA)
├── styles/               # Global CSS and Tailwind configuration
└── middleware.js         # Next.js middleware for auth and routing
```

## Getting Started

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Features

- **Feature-Based Architecture**: Modular design for easy feature addition and maintenance.
- **Role-Based Access Control**: Managed via middleware and permission guards.
- **Real-time Synchronization**: Live updates across the app using Socket.io.
- **Progressive Web App (PWA)**: Fully installable with offline capabilities.
- **Comprehensive UI Components**: Custom-built data tables, modals, and form elements.
- **Multi-App Support**: Integrated IMS and Task management systems within a single portal.

## Development

### Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint for code quality checks.
