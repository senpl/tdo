import {FocusManager, batchUpdatesAndNotify} from "cx/ui";
import {ArrayRef, updateArray} from "cx/data";
import {KeyCode, closest} from "cx/util";

import uid from "uid";
import {firestore} from "../../data/db/firestore";
const mergeFirestoreSnapshot = (prevList, snapshot, name) => {
    //TODO: Impement a more efficient data merge strategy
    let result = [];
    snapshot.forEach(doc => {
        result.push(doc.data());
    });
    //console.log(name, result);
    return result;
};

const OneDayMs = 24 * 60 * 60 * 1000;

export default ({ref, get, set}) => {

    const lists = ref("$page.lists").as(ArrayRef);
    const tasks = ref("$page.tasks").as(ArrayRef);
    const boardId = get("$route.boardId");
    const boardDoc = firestore.collection("boards").doc(boardId);

    const unsubscribeLists = boardDoc
        .collection("lists")
        .onSnapshot(snapshot => {
            lists.update(lists => mergeFirestoreSnapshot(lists, snapshot, "LISTS"));
        });

    const unsubscribeTasks = boardDoc
        .collection("tasks")
        .onSnapshot(snapshot => {
            tasks.update(tasks => mergeFirestoreSnapshot(tasks, snapshot, "TASKS"));
        });

    const updateTask = (task) => {
        tasks.update(
            updateArray,
            t => ({...t, ...task}),
            t => t.id === task.id
        );

        boardDoc
            .collection("tasks")
            .doc(task.id)
            .update(task);
    }

    const updateList = (list) => {
        lists.update(
            updateArray,
            t => ({...t, ...list}),
            t => t.id === list.id
        );

        boardDoc
            .collection("lists")
            .doc(list.id)
            .update(list);
    }

    // increease order and generate new task id
    // @partnerId is used to indicate subtask parent
    // @taskAddAsFirst if task should be first or last on added list
    // @insertPosition position to insert
    const prepareTask = (listId, parentId = 0, taskAddAsFirst = false, insertPosition = 2) => {
      let order, maxOrder, orderToSet;
      console.log("taskAddAsFirst");
      console.log(taskAddAsFirst);
      if (taskAddAsFirst) {
        //update all id below
        updateOrderBelowTask(listId, insertPosition, taskAddAsFirst);
        orderToSet = insertPosition+1;
      } else {
        order = getSortedTaskOrderList(listId);
        maxOrder = order[order.length - 1] || 0;
        orderToSet = maxOrder + 1;
      }

      let id = uid();
      set("newTaskId", id);
      return { id, listId, createdDate: new Date().toISOString(), order: orderToSet, parentId: parentId };
    };

    const updateOrderBelowTask = (listId, orderToStart, taskAddFromUp) => {
      let tasksToUpdate = getSortedTasks(listId);
    //   console.log("listOfTasks")
    //   console.log(tasksToUpdate);
    let tasksWithNewOrder;
      if(taskAddFromUp){
      let tasksWithNewOrder = updateTasksOrderBelow(tasksToUpdate, orderToStart);
      tasksWithNewOrder.forEach(task => updateTask(task));
      }
      return tasksWithNewOrder;
     };

    const updateTasksOrderBelow = (tasksToUpdate, orderToStart) => {
        // console.log("tasksToUpdate")
        // console.log(tasksToUpdate);
        let modifiedTasks=tasksToUpdate;
        for (let index = orderToStart; index < modifiedTasks.length; index++) {
            const task = modifiedTasks[index];
            task.order=task.order+1;
        }
        return modifiedTasks;
    };

    const getNotDeletedUpperTaskIdForList = (list, taskId = 0) => {
        var foundedMainTaskToAdd = 0;
        var finalUpperId=-1;
        list.forEach(element => {
        if (element.deleted != false) {
            foundedMainTaskToAdd = element.id;
        }
        if(element.id===taskId){
            finalUpperId = foundedMainTaskToAdd;
            return finalUpperId;
        }
    });
    return finalUpperId;
    };

    const getSortedTasks = listId => {
      return getTaskList(tasks.get(), t => t.listId == listId);
    };

    const getSortedTaskOrderList = listId => {
        return getOrderList(tasks.get(), t => t.listId == listId);
    };

 

    const makeTaskSubtask = (list,taskId) => {
        var upperId = getNotDeletedUpperTaskIdForList(list.taskId);
        return upperId;
    };

    const moveTaskToList = (taskId, listId) => {
        let order = getSortedTaskOrderList(listId);
        let taskOrder = (order[order.length - 1] || 0) + 1;
        set("activeTaskId", taskId);
        return updateTask({
            id: taskId,
            listId,
            order: taskOrder
        });
    };

    const hardDeleteTask = (task) => {
        boardDoc
            .collection("tasks")
            .doc(task.id)
            .delete();
    }

    return {
        onInit() {
            this.addTrigger('maintenance', [tasks, 'settings'], (tasks, settings) => {
                if (!settings || !tasks)
                    return;

                for (let task of tasks) {
                    if (task.deleted && Date.now() - task.deletedDate > settings.purgeDeletedObjectsAfterDays * OneDayMs)
                        hardDeleteTask(task);
                    else if (settings.deleteCompletedTasks && task.completed && Date.now() - task.completedDate > settings.deleteCompletedTasksAfterDays * OneDayMs)
                        hardDeleteTask(task);
                }
            });
        },

        onDestroy() {
            unsubscribeLists && unsubscribeLists();
            unsubscribeTasks && unsubscribeTasks();
        },

        addList(e) {
            if (e) e.preventDefault();
            let id = uid();

            boardDoc
                .collection("lists")
                .doc(id)
                .set({
                    id: id,
                    name: "New List",
                    edit: true,
                    createdDate: new Date().toISOString(),
                    boardId: boardId
                });
        },

        onSaveList(e, {store}) {
            let list = store.get("$list");
            boardDoc
                .collection("lists")
                .doc(list.id)
                .set({
                    ...list,
                    edit: false,
                    lastChangeDate: new Date().toISOString()
                });
        },

        deleteList(e, {store}) {
            let id = store.get("$list.id");

            updateList({
                id,
                deleted: true,
                deletedDate: new Date().toISOString()
            });
        },

        onSaveTask(task) {
            updateTask(task);
        },

        addTask(e, {store}) {
            e.preventDefault();
            let listId = store.get("$list.id");
            let task = prepareTask(listId);
            tasks.append(task);
            boardDoc
                .collection("tasks")
                .doc(task.id)
                .set(task);
        },

        addSubtaskTask(e, {store}) {
                e.preventDefault();
                let {$task} = store.getData();
                let aboveId=getNotDeletedUpperTaskIdForList(
                    tasks.get(),$task.id);
                let listId = store.get("$list.id");
                let orderToInsert = store.get("$list.taskAddAsFirst");
                let task = prepareTask(listId, aboveId, orderToInsert, $task.order);    
                tasks.append(task);
                boardDoc
                .collection("tasks")
                .doc(task.id)
                .set(task);
        },

        makeTaskSubtask(e, {store}) {
            e.stopPropagation();
            e.preventDefault();
            let {$task} = store.getData();
            let aboveId=getNotDeletedUpperTaskIdForList(
                tasks.get(),$task.id);
            updateTask({ ...$task, parentId: aboveId });
        },

        moveTaskUp(e, {store}) {
            e.stopPropagation();
            e.preventDefault();
            let {$task} = store.getData();
            let order = getSortedTaskOrderList($task.listId);
            let newOrder = getPrevOrder($task.order, order);
            updateTask({
                ...$task,
                order: newOrder
            });
        },

        moveTaskDown(e, {store}) {
            e.stopPropagation();
            e.preventDefault();
            let {$task} = store.getData();
            let order = getSortedTaskOrderList($task.listId);
            let newOrder = getNextOrder($task.order, order);
            updateTask({
                ...$task,
                order: newOrder
            });
        },

        moveTaskRight(e, {store}) {
            e.stopPropagation();
            e.preventDefault();
            let {$page, $task} = store.getData();
            let lists = $page.lists.filter(a => !a.deleted);
            lists.sort((a, b) => a.order - b.order);
            let listIndex = lists.findIndex(a => a.id == $task.listId);
            if (listIndex + 1 < lists.length)
                moveTaskToList($task.id, lists[listIndex + 1].id);
        },

        moveTaskLeft(e, {store}) {
            e.stopPropagation();
            e.preventDefault();
            let {$page, $task} = store.getData();
            let lists = $page.lists.filter(a => !a.deleted);
            lists.sort((a, b) => a.order - b.order);
            let listIndex = lists.findIndex(a => a.id == $task.listId);
            if (listIndex > 0) moveTaskToList($task.id, lists[listIndex - 1].id);
        },

        onTaskKeyDown(e, instance) {
            let {store, data} = instance;
            let t = data.task;
            let {$task} = store.getData();
            let code = c => c.charCodeAt(0);

            switch (e.keyCode) {
                case KeyCode.delete:
                case code("D"):
                    if (e.keyCode === code("D") && !e.shiftKey) return;

                    let item = closest(e.target, el =>
                        el.classList.contains("cxe-menu-item")
                    );
                    let elementReceivingFocus = item.nextElementSibling || item.previousElementSibling;

                    batchUpdatesAndNotify(() => {
                        updateTask({
                            id: $task.id,
                            deleted: true,
                            deletedDate: new Date().toISOString()
                        });
                    }, () => {
                        if (elementReceivingFocus)
                            FocusManager.focusFirst(elementReceivingFocus);
                    });

                    break;

                case KeyCode.insert:
                case code("O"):
                    let nt = getTasksInNewOrder(prepareTask, t, getSortedTaskOrderList, $task, e, code);

                    set("activeTaskId", nt.id);
                    updateTask(nt);
                    break;

                case KeyCode.alt:
                    let st = getTasksInNewOrder(prepareTask, t, getSortedTaskOrderList, $task, e, code);

                    set("activeTaskId", st.id);
                    this.addSubtaskTask(e, instance);
                    break;

                case KeyCode.up:
                    if (e.ctrlKey) this.moveTaskUp(e, instance);
                    break;

                case KeyCode.down:
                    if (e.ctrlKey) this.moveTaskDown(e, instance);
                    break;

                case KeyCode.right:
                    if (e.ctrlKey) this.moveTaskRight(e, instance);
                    else if (e.shiftKey) this.makeTaskSubtask(e, instance);
                    // this.addSubtaskTask(e, instance);
                    // else if (e.keyCode(18)) 
                    break;

                case KeyCode.left:
                    if (e.ctrlKey) this.moveTaskLeft(e, instance);
                    else if (e.shiftKey) this.makeTaskMainTask(e, instance);
                    break;
            }
        },

        onTaskListKeyDown(e, instance) {
            let code = c => c.charCodeAt(0),
                list;

            switch (e.keyCode) {
                case code("K"):
                    if (e.currentTarget.previousSibling)
                        FocusManager.focusFirst(e.currentTarget.previousSibling);
                    break;

                case code("J"):
                    if (e.currentTarget.nextSibling)
                        FocusManager.focusFirst(e.currentTarget.nextSibling);
                    break;

                case KeyCode.left:
                case code("H"):
                    list = closest(e.target, el => el.classList.contains("cxb-tasklist"));
                    if (list.previousSibling) FocusManager.focusFirst(list.previousSibling);
                    break;

                case KeyCode.right:
                case code("L"):
                    list = closest(e.target, el => el.classList.contains("cxb-tasklist"));
                    if (list.nextSibling) FocusManager.focusFirst(list.nextSibling);
                    break;
            }
        },

        listMoveLeft(e, {store}) {
            let {$list} = store.getData();
            let listOrder = getOrderList(lists.get());
            let newOrder = getPrevOrder($list.order, listOrder);
            updateList({
                id: $list.id,
                order: newOrder || 0
            });
        },

        listMoveRight(e, {store}) {
            let {$list} = store.getData();
            let listOrder = getOrderList(lists.get());
            let newOrder = getNextOrder($list.order, listOrder);
            updateList({
                id: $list.id,
                order: newOrder || 0
            });
        },

        boardMoveLeft(e, {store}) {
            let {boards, $board} = store.getData();
            let boardOrder = getOrderList(boards);
            let newOrder = getPrevOrder($board.order, boardOrder);
            let userId = store.get("user.id");

            firestore
                .collection("users")
                .doc(userId)
                .collection("boards")
                .doc($board.id)
                .update({
                    id: $board.id,
                    order: newOrder || 0
                });
        },

        boardMoveRight(e, {store}) {
            let {boards, $board} = store.getData();
            let boardOrder = getOrderList(boards);
            let newOrder = getNextOrder($board.order, boardOrder);
            let userId = store.get("user.id");

            firestore
                .collection("users")
                .doc(userId)
                .collection("boards")
                .doc($board.id)
                .update({
                    id: $board.id,
                    order: newOrder || 0
                });
        },

        deleteBoard(e, {store}) {
            boardDoc.update({
                deleted: true,
                deletedDate: new Date().toISOString()
            });
        },

        saveBoard(e, {store}) {
            let board = store.get("$board");
            let userId = store.get("user.id");

            firestore
                .collection("users")
                .doc(userId)
                .collection("boards")
                .doc(board.id)
                .set({
                    ...board,
                    edit: false,
                    lastChangeDate: new Date().toISOString()
                });
        }
    }
}

function getTasksInNewOrder(prepareTask, t, getSortedTaskOrderList, $task, e, code) {
    let nt = prepareTask(t.listId);
    let order = getSortedTaskOrderList(t.listId);
    let index = order.indexOf($task.order);
    //TODO: Fix insertion point
    let below = index < order.length - 1 && e.keyCode === code("O") && !e.shiftKey;
    nt.order = below
        ? getNextOrder($task.order, order)
        : getPrevOrder($task.order, order);
    return nt;
}

function getPrevOrder(currentOrder, orderList) {
    orderList.sort();
    let index = orderList.indexOf(currentOrder);
    if (index == -1) return 0;
    if (index == 0) return orderList[0];
    if (index == 1) return orderList[0] - 1;
    return (orderList[index - 2] + orderList[index - 1]) / 2;
}

function getNextOrder(currentOrder, orderList) {
    orderList.sort();
    let index = orderList.indexOf(currentOrder);
    if (index == -1) return 0;
    if (index + 1 == orderList.length) return orderList[orderList.length - 1];
    if (index + 2 == orderList.length) return orderList[orderList.length - 1] + 1;
    return (orderList[index + 1] + orderList[index + 2]) / 2;
}

function getOrderList(items, filter = () => true) {
    let list = items.filter(item => !item.deleted && filter(item)).map(a => a.order);
    list.sort();
    return list;
}

function getTaskList(items, filter = () => true) {
    let list = items
    .filter(item => !item.deleted && filter(item));
    return list;
}