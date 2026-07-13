// State management utilities - Redux-like store with React hooks

import { useEffect, useRef, useState } from 'react'

// === TYPES ===

export type Listener<T> = (state: T) => void
export type Selector<T, R> = (state: T) => R
export type Action = { type: string; payload?: any }
export type Reducer<T> = (state: T, action: Action) => T
export type Middleware<T> = (store: Store<T>) => (next: (action: Action) => void) => (action: Action) => void

// === STORE CLASS ===

export class Store<T> {
  private state: T
  private listeners: Set<Listener<T>> = new Set()
  private reducer: Reducer<T>
  private middlewares: Middleware<T>[] = []

  constructor(initialState: T, reducer: Reducer<T>, middlewares: Middleware<T>[] = []) {
    this.state = initialState
    this.reducer = reducer
    this.middlewares = middlewares
  }

  getState(): T {
    return this.state
  }

  dispatch(action: Action): void {
    // Apply middlewares
    let dispatch: (action: Action) => void = (a) => {
      this.state = this.reducer(this.state, a)
      this.notify()
    }

    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      dispatch = this.middlewares[i](this)(dispatch)
    }

    dispatch(action)
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state))
  }
}

// === REACT HOOKS ===

export function useStore<T>(store: Store<T>): T {
  const [state, setState] = useState<T>(store.getState())

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [store])

  return state
}

export function useSelector<T, R>(
  store: Store<T>,
  selector: Selector<T, R>,
  equalityFn: (a: R, b: R) => boolean = Object.is
): R {
  const [selectedState, setSelectedState] = useState<R>(() => selector(store.getState()))
  const previousSelectedRef = useRef<R>(selectedState)

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      const newSelected = selector(newState)
      if (!equalityFn(previousSelectedRef.current, newSelected)) {
        previousSelectedRef.current = newSelected
        setSelectedState(newSelected)
      }
    })
    return unsubscribe
  }, [store, selector, equalityFn])

  return selectedState
}

export function useDispatch<T>(store: Store<T>): (action: Action) => void {
  return (action: Action) => store.dispatch(action)
}

// === MIDDLEWARES ===

export function createLoggerMiddleware<T>(): Middleware<T> {
  return (store) => (next) => (action) => {
    console.log('[Action]', action.type, action.payload)
    console.log('[State Before]', store.getState())
    next(action)
    console.log('[State After]', store.getState())
  }
}

export function createThunkMiddleware<T>(): Middleware<T> {
  return (store) => (next) => (action: any) => {
    if (typeof action === 'function') {
      return action(store.dispatch.bind(store), store.getState.bind(store))
    }
    return next(action)
  }
}

export function createPersistMiddleware<T>(key: string): Middleware<T> {
  return (store) => (next) => (action) => {
    next(action)
    try {
      localStorage.setItem(key, JSON.stringify(store.getState()))
    } catch (error) {
      console.error('Failed to persist state:', error)
    }
  }
}

// === REDUCER HELPERS ===

export function combineReducers<T extends Record<string, any>>(
  reducers: { [K in keyof T]: Reducer<T[K]> }
): Reducer<T> {
  return (state: T, action: Action): T => {
    const nextState = {} as T
    let hasChanged = false

    for (const key in reducers) {
      const previousStateForKey = state[key]
      const nextStateForKey = reducers[key](previousStateForKey, action)
      nextState[key] = nextStateForKey
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }

    return hasChanged ? nextState : state
  }
}

export function createReducer<T>(
  initialState: T,
  handlers: Record<string, (state: T, action: Action) => T>
): Reducer<T> {
  return (state = initialState, action): T => {
    if (handlers[action.type]) {
      return handlers[action.type](state, action)
    }
    return state
  }
}

// === ACTION CREATORS ===

export function createAction<P = void>(type: string) {
  return (payload: P): Action => ({ type, payload })
}

export function createAsyncAction<P = void, R = any>(
  type: string,
  asyncFn: (payload: P) => Promise<R>
) {
  return (payload: P) => async (dispatch: (action: Action) => void) => {
    dispatch({ type: `${type}_PENDING`, payload })
    try {
      const result = await asyncFn(payload)
      dispatch({ type: `${type}_SUCCESS`, payload: result })
      return result
    } catch (error) {
      dispatch({ type: `${type}_ERROR`, payload: error })
      throw error
    }
  }
}

// === SELECTORS ===

export function createSelector<T, R1, Result>(
  selector1: Selector<T, R1>,
  combiner: (r1: R1) => Result
): Selector<T, Result>

export function createSelector<T, R1, R2, Result>(
  selector1: Selector<T, R1>,
  selector2: Selector<T, R2>,
  combiner: (r1: R1, r2: R2) => Result
): Selector<T, Result>

export function createSelector<T, R1, R2, R3, Result>(
  selector1: Selector<T, R1>,
  selector2: Selector<T, R2>,
  selector3: Selector<T, R3>,
  combiner: (r1: R1, r2: R2, r3: R3) => Result
): Selector<T, Result>

export function createSelector(...args: any[]): any {
  const selectors = args.slice(0, -1) as Selector<any, any>[]
  const combiner = args[args.length - 1] as (...results: any[]) => any

  let lastArgs: any[] | null = null
  let lastResult: any = null

  return (state: any) => {
    const args = selectors.map(selector => selector(state))
    
    if (lastArgs && args.every((arg, i) => arg === lastArgs![i])) {
      return lastResult
    }

    lastArgs = args
    lastResult = combiner(...args)
    return lastResult
  }
}

// === DEVTOOLS ===

export function createDevToolsMiddleware<T>(): Middleware<T> {
  return (store) => (next) => (action) => {
    if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
      const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect()
      devTools.send(action, store.getState())
    }
    return next(action)
  }
}

// === EXAMPLE USAGE ===

/*
// Define state type
interface AppState {
  user: { name: string; email: string } | null
  todos: Array<{ id: number; text: string; completed: boolean }>
  loading: boolean
}

// Create initial state
const initialState: AppState = {
  user: null,
  todos: [],
  loading: false,
}

// Create reducers
const userReducer = createReducer(initialState.user, {
  'USER_LOGIN': (state, action) => action.payload,
  'USER_LOGOUT': () => null,
})

const todosReducer = createReducer(initialState.todos, {
  'ADD_TODO': (state, action) => [...state, action.payload],
  'TOGGLE_TODO': (state, action) => 
    state.map(todo => 
      todo.id === action.payload ? { ...todo, completed: !todo.completed } : todo
    ),
  'DELETE_TODO': (state, action) => 
    state.filter(todo => todo.id !== action.payload),
})

const loadingReducer = createReducer(initialState.loading, {
  'SET_LOADING': (state, action) => action.payload,
})

// Combine reducers
const rootReducer = combineReducers({
  user: userReducer,
  todos: todosReducer,
  loading: loadingReducer,
})

// Create store with middlewares
export const store = new Store(
  initialState,
  rootReducer,
  [
    createThunkMiddleware(),
    createLoggerMiddleware(),
    createPersistMiddleware('app-state'),
  ]
)

// Create action creators
export const loginUser = createAction<{name: string; email: string}>('USER_LOGIN')
export const logoutUser = createAction('USER_LOGOUT')
export const addTodo = createAction<{id: number; text: string; completed: boolean}>('ADD_TODO')

// Create selectors
export const selectUser = (state: AppState) => state.user
export const selectTodos = (state: AppState) => state.todos
export const selectCompletedTodos = createSelector(
  selectTodos,
  (todos) => todos.filter(t => t.completed)
)

// Use in components
function MyComponent() {
  const todos = useSelector(store, selectTodos)
  const dispatch = useDispatch(store)

  const handleAddTodo = () => {
    dispatch(addTodo({ id: Date.now(), text: 'New todo', completed: false }))
  }

  return (
    <div>
      {todos.map(todo => (
        <div key={todo.id}>{todo.text}</div>
      ))}
      <button onClick={handleAddTodo}>Add Todo</button>
    </div>
  )
}
*/
