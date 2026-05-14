# Wadsworth

A personal **read-only** file browser for macOS, Windows, and Linux, designed for one job: finding and reading the documents you already have, very quickly.

Wadsworth is **not** a Finder / Explorer replacement. It does not copy, move, rename, or delete files. What it does is let you organize your documents into a sidebar you control, search them instantly, and preview them inline — PDFs, images, source code with syntax highlighting, rendered Markdown, Office files, and more.

## Who this is for

People who manage a lot of documents and need to retrieve them under time pressure:

- Bookkeepers, lawyers, accountants, real estate agents
- Anyone whose work involves "find this client's invoice / contract / record in the next 10 seconds"
- Developers and writers who keep deep folder hierarchies and want a faster way to navigate them

If your problem is "I navigate 8 levels deep in Finder every single time I want to find something," Wadsworth is for you.

## Features

- **Custom sidebar with named sections** — group your bookmarks by Clients, Businesses, Projects, etc.
- **Domains** — multiple independent sidebar configurations, switchable from a dropdown or tab bar.
- **Live preview pane** — PDFs (interactive viewer), images, text files with full syntax highlighting via CodeMirror, rendered Markdown, plus QuickLook fallback on macOS for Word/Excel/PowerPoint and anything else.
- **Spotlight-powered search** — type and find anywhere on your Mac, with results revealed in the folder tree.
- **Per-folder memory** — Wadsworth remembers tree expansion, selected file, and open preview for every folder you visit.
- **Vim-style keyboard navigation** — `hjkl` and arrow keys, plus pane-switching with `h` / `l` and `Space` for expand/collapse.
- **Light and dark themes** with automatic system preference matching.
- **Native macOS title bar** integration.

## Installation

Download the latest version from the **[Releases page](https://github.com/paradebk/wadsworth/releases)**.

### macOS

1. Download the file ending in **`-arm64.dmg`** (for Apple Silicon Macs — M1, M2, M3, M4, etc.).
2. Open the disk image and drag **Wadsworth** to your `Applications` folder.
3. **First launch:** the app is not signed with a paid Apple Developer certificate, so macOS will warn you that it can't verify the developer. To approve it once:
   - Right-click `Wadsworth.app` in `Applications`
   - Choose **Open**
   - Click **Open** again in the dialog
4. After this one-time approval, you can launch normally (double-click, Spotlight, Dock, etc.).
5. To keep it in the Dock: right-click the running app's Dock icon → **Options** → **Keep in Dock**.

### Windows

1. Download the file ending in **`-setup.exe`**.
2. Run the installer.
3. Windows SmartScreen will warn: *"Windows protected your PC."* This is because the installer is not signed with an EV certificate. To proceed:
   - Click **More info**
   - Click **Run anyway**
4. Follow the installer prompts.

### Linux

**AppImage (works on any distribution):**

```bash
chmod +x wadsworth-*.AppImage
./wadsworth-*.AppImage
```

**Debian / Ubuntu / derivatives:**

```bash
sudo dpkg -i wadsworth-*.deb
```

Then launch Wadsworth from your application menu.

## Keyboard reference

### Sidebar focused

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down to next bookmark |
| `k` / `↑` | Move up to previous bookmark |
| `l` / `→` | Move focus to file pane |
| `k` from top item (in tab mode) | Move to tab bar |

### Tab bar focused (when "Display domains as tabs" is on)

| Key | Action |
|-----|--------|
| `h` / `←` | Previous domain |
| `l` / `→` | Next domain |
| `j` / `↓` | Move focus to sidebar |

### File pane focused

| Key | Action |
|-----|--------|
| `j` / `↓` | Next file or folder |
| `k` / `↑` | Previous file or folder |
| `l` / `→` / `Enter` | Drill into folder, or open file in preview |
| `h` / `←` | Move focus back to sidebar |
| `Space` | Expand or collapse selected folder (tree view) |
| `⌘[` / `⌘←` | History back |
| `⌘↑` | Go up to parent folder |

## Development

Prerequisites: Node.js 22 or later.

```bash
git clone git@github.com:paradebk/wadsworth.git
cd wadsworth
npm install
npm run dev
```

The dev process uses a separate user data directory so it won't interfere with an installed copy of Wadsworth running at the same time.

### Building locally

```bash
npm run build:mac     # macOS .dmg + .zip
npm run build:win     # Windows installer
npm run build:linux   # Linux AppImage + .deb
```

On macOS, you can also build and install in one step:

```bash
npm run install:mac
```

This rebuilds the `.app`, removes the existing copy in `/Applications`, and copies the fresh build over using `ditto` (which preserves the ad-hoc code signature properly).

### Releasing

The build pipeline runs automatically on every push to `main` and uploads platform-specific artifacts as a **draft release** named after the current `version` in `package.json`. To publish a new release:

1. Bump the `version` field in `package.json`.
2. Commit and push to `main`.
3. Wait for the GitHub Actions workflow to finish all three platforms.
4. Go to the Releases page and **Publish** the draft.

## License

License has not yet been chosen. The repository is private during early development. Open-sourcing under a permissive license (MIT or Apache 2.0) is planned.
