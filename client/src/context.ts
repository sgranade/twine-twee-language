import * as vscode from "vscode";

/**
 * Manages the extension's context.
 */

type ContextEvent =
    | "buildStarts"
    | "buildEnds"
    | "buildSuccessful"
    | "indexingStarts"
    | "indexingEnds"
    | "runStarts"
    | "runEnds";

const contextListenerManagers: Record<string, EventListenerManager> = {};

/**
 * Class that keeps track of whether or not it's been disposed.
 */
class FlaggedDispose {
    disposed = false;
    dispose() {
        this.disposed = true;
    }
}

/**
 * A generic listener that takes a list of parameters.
 */
interface EventListener {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (...params: any[]): void;
}

/**
 * Wraps a Listener to make it disposable.
 */
class EventListenerWrapper extends FlaggedDispose {
    handler: EventListener;
    constructor(handler: EventListener) {
        super();
        this.handler = handler;
    }
}

/**
 * Manages multiple listeners for a given event.
 */
class EventListenerManager {
    listenMethods: EventListenerWrapper[] = [];

    handleNotification(manager: EventListenerManager, ...params) {
        manager.listenMethods = manager.listenMethods.filter(
            (v) => !v.disposed
        );
        for (const listenMethod of manager.listenMethods) {
            listenMethod.handler(...params);
        }
    }
}

/**
 * Add a listener to be notified when a context event occurs.
 *
 * @param event Context event to listen to.
 * @param listener Listener function to be notified on a successful build.
 * @returns Disposable that, when disposed, cancels the listener.
 */
export function addListener(
    event: ContextEvent,
    listener: EventListener
): vscode.Disposable {
    const wrapper = new EventListenerWrapper(listener);
    let manager = contextListenerManagers[event];
    if (manager === undefined) {
        manager = new EventListenerManager();
        contextListenerManagers[event] = manager;
    }
    manager.listenMethods.push(wrapper);
    return vscode.Disposable.from(wrapper);
}

/**
 * Signal that a context event has occurred.
 *
 * @param event Event to signal.
 * @param params Parameters to pass to listeners.
 */
export function signalContextEvent(event: ContextEvent, ...params) {
    const manager = contextListenerManagers[event];
    manager?.handleNotification(manager, params);
}
