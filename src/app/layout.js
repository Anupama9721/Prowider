import './globals.css';

export const metadata = {
  title: 'Prowider — Lead Distribution System',
  description: 'Smart lead allocation for service providers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="navbar-inner">
            <a href="/" className="brand">PROWIDER</a>
            <div className="nav-links">
              <a href="/request-service">Submit Lead</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/test-tools">Test Tools</a>
            </div>
          </div>
        </nav>
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
