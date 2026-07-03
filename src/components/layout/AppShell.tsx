import { useEffect } from "react";
import { FolderTree, PhotoGrid } from "@/features/library";
import { ExportDialog } from "@/features/export/ExportDialog";
import { ExportPage } from "@/features/export/ExportPage";
import { SettingsPage } from "@/features/settings";
import { ToastContainer } from "@/components/ToastContainer";
import { useAppSettingsStore } from "@/stores/useAppSettingsStore";
import { useUIStore } from "@/stores/useUIStore";
import { DevelopFilmstrip } from "./DevelopFilmstrip";
import { Filmstrip } from "./Filmstrip";
import { MainWorkspace } from "./MainWorkspace";
import { TopBar } from "./TopBar";

type Props = { view: "library" | "develop" | "export" | "settings" };

export function AppShell({ view }: Props) {
  const loadSettings = useAppSettingsStore((s) => s.loadSettings);
  const settingsLoaded = useAppSettingsStore((s) => s.loaded);
  const developFilmstripVisible = useUIStore((s) => s.developFilmstripVisible);

  useEffect(() => {
    if (!settingsLoaded) void loadSettings();
  }, [settingsLoaded, loadSettings]);

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
            {developFilmstripVisible && <DevelopFilmstrip />}
          </div>
        )}
        {view === "export" && <ExportPage />}
        {view === "settings" && <SettingsPage />}
      </div>
      <ExportDialog />
      <ToastContainer />
    </div>
  );
}
