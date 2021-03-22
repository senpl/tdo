// import { CollectionTracker } from "./CollectionTracker";
// import { firestore } from "./db/firestore" ;
// import { ShallowIndex } from "./ShallowIndex";
// import { List } from "./List";

// let indexCache: {[key:string]: ShallowIndex<List>} = {};

export class SubtasksUtils {
    // constructor(boardId: string, onUpdate: () => void) {
    //     let collection = firestore.collection("boards").doc(boardId).collection("lists");
    //     let index = indexCache[boardId];
    //     if (!index)
    //         index = indexCache[boardId] = new ShallowIndex<List>();
    //     super(collection, index, onUpdate)
    // }

    // reorder(suppressUpdate?: boolean) {
    //     let dirty = false;
    //     this.index
    //         .filter(l => !l.deleted)
    //         .sort((a, b) => a.order - b.order)
    //         .forEach((task, index) => {
    //             if (this.update(task.id, { order: index }, { suppressUpdate: true }))
    //                 dirty = true;
    //         });
    //     if (dirty && !suppressUpdate)
    //         this.onUpdate();
    // }

    // getActiveLists() {
    //     return this.index
    //         .filter(l => !l.deleted)
    //         .sort((a, b) => a.order - b.order);
    // }

    

}

function getTasksInNewOrder(prepareTask, t, getSortedTaskOrderList, $task, e, code) {
    let nt = prepareTask(t.listId);
    let order = getSortedTaskOrderList(t.listId, t);
    let index = order.indexOf($task.order);
    //TODO: Fix insertion point
    let below = index < order.length - 1 && e.keyCode === code("O") && !e.shiftKey;
    nt.order = below ?
        getNextOrder($task.order, order) :
        getPrevOrder($task.order, order);
    return nt;
}
function prepereSubtaskTasks(prepareTask, t, getSortedTaskOrderList, $task, e, code) {
    let nt = prepareTask(t.listId, t.order, t.parentId, true);
    return nt;
}
function getPrevOrder(currentOrder, orderList) {
    orderList.sort();
    let index = orderList.indexOf(currentOrder);
    if (index == -1)
        return 0;
    if (index == 0)
        return orderList[0];
    if (index == 1)
        return orderList[0] - 1;
    return (orderList[index - 2] + orderList[index - 1]) / 2;
}
function getNextOrder(currentOrder, orderList) {
    orderList.sort();
    let index = orderList.indexOf(currentOrder);
    if (index == -1)
        return 0;
    if (index + 1 == orderList.length)
        return orderList[orderList.length - 1];
    if (index + 2 == orderList.length)
        return orderList[orderList.length - 1] + 1;
    return (orderList[index + 1] + orderList[index + 2]) / 2;
}

export function getOrderList(items, filter = (item) => true) {
    let list = items.filter(item => !item.deleted && filter(item)).map(a => a.order);
    list.sort();
    return list;
}

export function getTaskList(items, filter = (item) => true) {
    let list = items.filter(item => !item.deleted );
    return list;
}