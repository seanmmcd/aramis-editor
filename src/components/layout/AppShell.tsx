import { FolderTree, PhotoGrid } from "@/features/library";
import { ExportDialog } from "@/features/export/ExportDialog";
import { ExportPage } from "@/features/export/ExportPage";
import { DevelopFilmstrip } from "./DevelopFilmstrip";
import { Filmstrip } from "./Filmstrip";
import { MainWorkspace } from "./MainWorkspace";
import { TopBar } from "./TopBar";

type Props = { view: "library" | "develop" | "export" };

export function AppShell({ view }: Props) {
  return (
    <div className="flex h-screen flex-col bg-ae-bg-primary">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {view === "library" && (
          <>
            <aside className="w-64 shrink-0 border-r border-ae-border">
              <FolderTree />
            </aside>
            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              <PhotoGrid />
              <Filmstrip />
            </main>
          </>
        )}
        {view === "develop" && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <MainWorkspace />
            <DevelopFilmstrip />
          </div>
        )}
        {view === "export" && <ExportPage />}
      </div>
      <ExportDialog />
    </div>
  );
}
