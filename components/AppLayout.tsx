import React from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { Button } from "./Button";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover";
import styles from "./AppLayout.module.css";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const [searchParams] = useSearchParams();
  const isUnfoldActive = location.pathname.startsWith("/unfolder");
  const isStudio = location.pathname.startsWith("/studio") || location.pathname === "/";
  const urlMode = searchParams.get('mode');
  const isPackagingActive = isStudio && (!urlMode || urlMode === 'packaging');
  const isOrigamiActive = isStudio && urlMode === 'origami';
  const isPopupActive = isStudio && urlMode === 'popup';
  const isSpiroActive = isStudio && urlMode === 'spirogami';

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.leftNav}>
          <Link to="/" className={styles.logo}>
            <svg
              width="24"
              height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.logoIcon}
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span className={styles.logoText}>Fold Studio Lab</span>
            <span className={styles.versionBadge}>Alpha</span>
          </Link>

          <div className={styles.navSeparator} />
          
          <nav className={styles.navTabs} aria-label="Workshops">
            <Link 
              to="/studio?mode=packaging" 
              className={`${styles.navTab} ${isPackagingActive ? styles.navTabActive : ''}`}
              aria-current={isPackagingActive ? 'page' : undefined}
            >
              Fold
            </Link>
            <Link 
              to="/unfolder" 
              className={`${styles.navTab} ${isUnfoldActive ? styles.navTabActive : ''}`}
              aria-current={isUnfoldActive ? 'page' : undefined}
            >
              Unfold
            </Link>
            <Link 
              to="/studio?mode=origami" 
              className={`${styles.navTab} ${isOrigamiActive ? styles.navTabActive : ''}`}
              aria-current={isOrigamiActive ? 'page' : undefined}
            >
              Origami
            </Link>
            <Link 
              to="/studio?mode=popup" 
              className={`${styles.navTab} ${isPopupActive ? styles.navTabActive : ''}`}
              aria-current={isPopupActive ? 'page' : undefined}
            >
              Pop-Up
            </Link>
            <Link 
              to="/studio?mode=spirogami" 
              className={`${styles.navTab} ${isSpiroActive ? styles.navTabActive : ''}`}
              aria-current={isSpiroActive ? 'page' : undefined}
            >
              Spirogami
            </Link>
          </nav>
        </div>
        
        <div className={styles.actions}>
          <Popover>
            <PopoverTrigger asChild>
              <button className={styles.navLink}>About</button>
            </PopoverTrigger>
            <PopoverContent className={styles.aboutPopover} sideOffset={8}>
              <div className={styles.aboutSection}>
                <h3 className={styles.aboutTitle}>Credits</h3>
                <p className={styles.aboutText}>
                  Designed and developed by{" "}
                  <a href="https://etienne.design" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
                    Étienne Mineur
                  </a>
                </p>
              </div>
              <div className={styles.aboutDivider} />
              <div className={styles.aboutSection}>
                <h3 className={styles.aboutTitle}>Technologies</h3>
                <p className={styles.aboutText}>
                  Static edition: editing and exports run in your browser, with no accounts or AI services.
                  Folding previews and intersection checks are design aids, not fabrication certification.
                </p>
                <ul className={styles.techList}>
                  <li>
                    <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>React</a>
                    <span className={styles.techDesc}> — User Interface</span>
                  </li>
                  <li>
                    <a href="https://threejs.org" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>Three.js</a>
                    <span className={styles.techDesc}> — 3D Rendering</span>
                  </li>
                  <li>
                    <a href="https://docs.pmnd.rs/react-three-fiber" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>React Three Fiber</a>
                    <span className={styles.techDesc}> — React + Three.js Integration</span>
                  </li>
                  <li>
                    <a href="https://typescriptlang.org" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>TypeScript</a>
                    <span className={styles.techDesc}> — Type Safety</span>
                  </li>
                  <li>
                    <a href="https://pdfmake.github.io/docs" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>pdfmake</a>
                    <span className={styles.techDesc}> — PDF Export</span>
                  </li>
                </ul>
              </div>
            </PopoverContent>
          </Popover>
          {isAuthenticated && (
            <button className={`${styles.navLink} ${styles.logoutBtn}`} onClick={handleLogout}>
              <LogOut size={14} />
              Sign Out
            </button>
          )}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}