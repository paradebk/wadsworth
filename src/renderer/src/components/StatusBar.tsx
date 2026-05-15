type Props = {
  viewMode: 'flat' | 'tree'
  visibleCount: number
  rowCount: number
  hiddenCount: number
  showHidden: boolean
  selectedPath: string | null
}

export function StatusBar({
  viewMode,
  visibleCount,
  rowCount,
  hiddenCount,
  showHidden,
  selectedPath
}: Props): React.JSX.Element {
  return (
    <footer className="statusbar">
      <span className="statusbar-left">
        {viewMode === 'flat'
          ? `${visibleCount} item${visibleCount === 1 ? '' : 's'}`
          : `${rowCount} shown`}
        {hiddenCount > 0 && !showHidden ? ` · ${hiddenCount} hidden` : ''}
      </span>
      <span className="statusbar-right" title={selectedPath ?? ''}>
        {selectedPath ?? ''}
      </span>
    </footer>
  )
}
