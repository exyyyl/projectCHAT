export type AppView =
  | "polls"
  | "presets"
  | "widget"
  | "input-overlay"
  | "contests"
  | "stream-dock"
  | "settings"
export type TabView = AppView | "new"
export type WorkspaceTab = {
  id: string
  history: TabView[]
  position: number
  visited: AppView[]
}
export type NavigationState = { tabs: WorkspaceTab[]; activeId: string }
export type NavigationAction =
  | { type: "navigate"; view: AppView; tabId?: string }
  | { type: "create"; id: string }
  | { type: "select"; id: string }
  | { type: "close"; id: string }
  | { type: "history"; offset: -1 | 1 }

export function initialNavigation(): NavigationState {
  return {
    tabs: [
      { id: "initial", history: ["polls"], position: 0, visited: ["polls"] },
    ],
    activeId: "initial",
  }
}

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction
): NavigationState {
  if (action.type === "create")
    return {
      tabs: [
        ...state.tabs,
        { id: action.id, history: ["new"], position: 0, visited: [] },
      ],
      activeId: action.id,
    }
  if (action.type === "select")
    return state.tabs.some((tab) => tab.id === action.id)
      ? { ...state, activeId: action.id }
      : state
  if (action.type === "close") {
    if (state.tabs.length === 1) return state
    const index = state.tabs.findIndex((tab) => tab.id === action.id)
    if (index < 0) return state
    const tabs = state.tabs.filter((tab) => tab.id !== action.id)
    return {
      tabs,
      activeId:
        state.activeId === action.id
          ? tabs[Math.min(index, tabs.length - 1)].id
          : state.activeId,
    }
  }
  return {
    ...state,
    tabs: state.tabs.map((tab) => {
      if (
        tab.id !==
        (action.type === "navigate"
          ? action.tabId || state.activeId
          : state.activeId)
      )
        return tab
      if (action.type === "history")
        return {
          ...tab,
          position: Math.max(
            0,
            Math.min(tab.history.length - 1, tab.position + action.offset)
          ),
        }
      if (tab.history[tab.position] === action.view) return tab
      return {
        ...tab,
        history: [...tab.history.slice(0, tab.position + 1), action.view],
        position: tab.position + 1,
        visited: tab.visited.includes(action.view)
          ? tab.visited
          : [...tab.visited, action.view],
      }
    }),
  }
}
