import type { ReactNode } from "react";
import { DownloadIcon } from "@/components/icons";
import { getPhotoBytes } from "@/lib/together";
import { COUPLE_PHOTO_BYTES, formatBytes } from "@/lib/together-rules";
import { SkelButton, SkelParagraph, SkelText } from "@/components/skeleton";
import { CSV_KINDS } from "@/lib/export-rules";
import { getMessages } from "@/lib/i18n";
import { ImportHistory } from "./import-history";

// Settings' two Sprint 18 panels: "Bring in your history" (import from Letterboxd or IMDb) and "Your data"
// (export everything as JSON or CSVs).

/** "Bring in your history": the file picker, preview and import live in ImportHistory (client). */
export function ImportPanel({ language }: { language: string }) {
  const t = getMessages(language).diary.import;
  return (
    <section className="card grid gap-4" aria-labelledby="import-history">
      <div className="grid gap-1.5">
        <h2 id="import-history" className="display-ink text-2xl">
          {t.heading}
        </h2>
        <p className="max-w-[65ch] text-muted">{t.intro}</p>
      </div>
      <ImportHistory language={language} />
    </section>
  );
}

/** "Your data": plain links to the export route, which answers with a file to save. */
export function ExportPanel({ language, children }: { language: string; children?: ReactNode }) {
  const t = getMessages(language).diary.export;
  return (
    <section className="card grid gap-4" aria-labelledby="your-data">
      <div className="grid gap-1.5">
        <h2 id="your-data" className="display-ink text-2xl">
          {t.heading}
        </h2>
        <p className="max-w-[65ch] text-muted">{t.intro}</p>
        {children}
      </div>
      <a href="/settings/export?format=json" download className="btn w-fit">
        <DownloadIcon className="size-4" />
        {t.json}
      </a>
      <div className="grid gap-2">
        <h3 className="font-bold">{t.csvHeading}</h3>
        <ul className="flex flex-wrap gap-2">
          {CSV_KINDS.map((kind) => (
            <li key={kind}>
              <a href={`/settings/export?format=csv&kind=${kind}`} download className="btn-quiet text-sm">
                <DownloadIcon className="size-3.5" />
                {t.csv[kind]}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Both panels while Settings loads, block for block. */
export function YourDataSkeleton() {
  return (
    <>
      <div className="card grid gap-4">
        <div className="grid gap-1.5">
          <SkelText bar="ink" className="display-ink text-2xl" width="60%" />
          <SkelParagraph lines={6} smLines={3} />
        </div>
        <div className="grid gap-4">
          <SkelParagraph className="text-sm font-medium" lines={4} smLines={2} />
          <SkelButton quiet width="11rem" icon="size-4" />
        </div>
      </div>
      <div className="card grid gap-4">
        <div className="grid gap-1.5">
          <SkelText bar="ink" className="display-ink text-2xl" width="35%" />
          <SkelParagraph lines={5} smLines={3} />
        </div>
        <SkelButton width="15rem" icon="size-4" />
        <div className="grid gap-2">
          <SkelText className="font-bold" width="12rem" />
          <div className="flex flex-wrap gap-2">
            {["5.5rem", "7.5rem", "8.5rem", "8rem", "6rem"].map((width) => (
              <SkelButton key={width} quiet width={width} icon="size-3.5" className="text-sm" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/** How much space the night albums take (Sprint 20), under the export panel's intro. Nothing until there are photos. */
export async function PhotoUsage({ coupleId, language }: { coupleId: string; language: string }) {
  const bytes = await getPhotoBytes(coupleId);
  if (bytes === 0) return null;
  const t = getMessages(language).diary.export;
  return <p className="max-w-[65ch] text-sm text-muted">{t.photos(formatBytes(bytes, language), formatBytes(COUPLE_PHOTO_BYTES, language))}</p>;
}
