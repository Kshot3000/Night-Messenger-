import Link from "next/link";
import { Brand } from "./Brand";
import { DonationCard } from "./DonationCard";
import { Icon } from "./Icon";
export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <div>
        <Brand />
        <p>A quieter corner of the internet.</p>
        <DonationCard />
      </div>
      <div className="footer-links">
        <Link href="/security">Privacy & transparency</Link>
        <a
          href="https://github.com/Kshot3000/Night-Messenger-"
          target="_blank"
          rel="noreferrer"
        >
          Made in the open <Icon name="arrowUp" size={14} />
        </a>
        <a
          href="https://x.com/kshot9000"
          target="_blank"
          rel="noreferrer"
        >
          X · @kshot9000 <Icon name="arrowUp" size={14} />
        </a>
        <span>Built by Kshot · For the Midnight ecosystem</span>
      </div>
    </footer>
  );
}
