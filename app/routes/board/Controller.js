import { FocusManager, batchUpdatesAndNotify, batchUpdates } from "cx/ui";
import { ArrayRef } from "cx/data";
import { KeyCode, closest } from "cx/util";
import { Toast, Button, Text } from "cx/widgets";

import uid from "uid";
import lodash from "lodash"
import { BoardTasksTracker } from "../../data/BoardTasksTracker";
import { BoardListsTracker } from "../../data/BoardListsTracker";
import { getAdvancedSearchQueryPredicate } from "../../util/getAdvancedSearchQueryPredicate";
import { showUndoToast } from "../../components/toasts";
const OneDayMs = 24 * 60 * 60 * 1000;

//TODO probably remove as it is used in other way 
import {
    updateArray
} from "cx/data";

export default ({ store, ref, get, set }) => {
    const lists = ref("$page.lists").as(ArrayRef);
    const tasks = ref("$page.tasks").as(ArrayRef);
    const boardId = get("$route.boardId");

    let maintenancePerformed = false;

    const refreshTasks = () => {
        let search = get("search");
        let searchPredicate = search && search.query ? getAdvancedSearchQueryPredicate( search.query) : null;

        tasks.set(taskTracker.index.filter(t => {
            if (t.deleted)
                return false;
            return !searchPredicate || t.isNew || (t.name && searchPredicate(t.name));
        }));

        if (!maintenancePerformed) {
            maintenancePerformed = true;
            setTimeout(maintenance, 1);
        }
    };

    const taskTracker = new BoardTasksTracker(boardId, refreshTasks);

    const refreshLists = () => {
        lists.set(getListsSorted());
    };

    const listTracker = new BoardListsTracker(boardId, refreshLists);

      const updateTask = (task) => {
              tasks.update(
                  updateArray,
                  t => ({
                      ...t,
                      ...task
                  }),
                  t => t.id === task.id
              )
            //   listTracker.refreshTasks();
        };

    const getVisibleListTasks = (listId) => {
        return tasks
            .get()
            .filter(t => t.listId == listId && !t.deleted)
            .sort((a, b) => a.order - b.order);
    };

    function activateTask(id) {
        let taskEl = document.getElementById(`task-${id}`);
        if (taskEl)
            taskEl.focus();
    }

    function editTask(id) {
        batchUpdatesAndNotify(
            () => {
                set("newTaskId", id);
            }, () => {
                if (get("newTaskId") == id)
                    store.silently(() => set("newTaskId", null));
            }
        );
    }

        // increease order and generate new task id
        // @partnerId is used to indicate subtask parent
        // @taskAddAsFirst if task should be first or last on added list
        // @insertPosition order on which insert
        const prepareTask = (listId, insertPosition = 0, parentId = 0, taskAddAsFirst = false) => {
            let order, maxOrder, orderToSet;
            if (taskAddAsFirst) {
                //update all order below
                updateOrderBelowTask(listId, insertPosition + 1);
                orderToSet = insertPosition + 1;
            } else {
                order = getSortedTaskOrderList(listId);
                maxOrder = order[order.length - 1] || 0;
                orderToSet = maxOrder + 1;
            }
            let id = uid();
            set("newTaskId", id);
            return {
                id,
                listId,
                createdDate: new Date().toISOString(),
                order: orderToSet,
                parentId: parentId
            };
        };

        const updateOrderBelowTask = (listId, orderToStart, taskAddFromUp) => {
            let tasksToUpdate = getSortedTasks(listId);
            let tasksWithNewOrder = updateTasksOrderBelow(tasksToUpdate, orderToStart);
            tasksWithNewOrder.forEach(task => updateTask(task));
            // listTracker.update(list.id, {
            //order
            //},
            return tasksWithNewOrder;
        };

        const updateTasksOrderBelow = (tasksToUpdate, orderToStart) => {
            let modifiedTasks = tasksToUpdate;
            for (let index = orderToStart - 1; index < modifiedTasks.length; index++) {
                const task = modifiedTasks[index];
                task.order = index + 2;
                modifiedTasks[index] = task;
            }
            return modifiedTasks;
        };

         const getDeletedIds = (list) => {
             let foundedIdToDelete = [];
             list.forEach(element => {
                 if (element.deleted) {
                     foundedIdToDelete.push(element.id)
                 }
             });
             return foundedIdToDelete;
         };

         const getNotDeletedUpperOrderIdForList = (list, taskId = 0) => {
             let foundedMainTaskOrder = 0;
             let finalOrder = 0;
             list.forEach(element => {
                 if (element.deleted !== true && element.id != taskId) {
                     foundedMainTaskOrder = element.order;
                 }
                 if (element.id === taskId) {
                     finalOrder = foundedMainTaskOrder;
                     return finalOrder + 1;
                 }
             });
             return finalOrder;
         };

         const getNotDeletedUpperTaskIdForList = (list, taskId = 0) => {
             let foundedMainTaskToAdd = 0;
             let finalUpperId = -1;
             list.forEach(element => {
                 if (element.deleted !== true && element.id != taskId) {
                     foundedMainTaskToAdd = element.id;
                 }
                 if (element.id === taskId) {
                     finalUpperId = foundedMainTaskToAdd;
                     return finalUpperId;
                 }
             });
             return finalUpperId;
         };

            const getMainIdAbove = (list, taskId = 0) => {
                // console.log("list")
                // console.log(list)
                let foundedMainTaskToAdd = 0;
                let finalUpperId = -1;
                list.forEach(element => {
                    if (element.deleted !== true && element.parentId === 0 && element.id != taskId) {
                        foundedMainTaskToAdd = element.id;
                    }
                    if (element.id === taskId) {
                        finalUpperId = foundedMainTaskToAdd;
                        // console.log("finalUpperId")
                        // console.log(finalUpperId)
                        return finalUpperId;
                    }
                });
                return finalUpperId;
            };

              const getSortedTasks = listId => {
                  let sortedList = _.sortBy(tasks.get(), "order");
                  return getTaskList(sortedList, t => t.listId == listId);
              };

              const getSortedTaskOrderList = listId => {
                  return getOrderList(tasks.get(), t => t.listId == listId);
              }

    function deleteTask(task) {
        let listTasks = getVisibleListTasks(task.listId);
        let taskIndex = listTasks.findIndex(t => t.id == task.id);
        let nextTask = listTasks[taskIndex + 1] || listTasks[taskIndex - 1];

        batchUpdatesAndNotify(
            () => {
                taskTracker.update(
                    task.id,
                    {
                        deleted: true,
                        deletedDate: new Date().toISOString()
                    },
                    { suppressUpdate: true }
                );
                taskTracker.reorderList(task.listId, true);
                refreshTasks();
            },
            () => {
                if (nextTask) {
                    activateTask(nextTask.id);
                    console.log(nextTask);
                }
            }
        );
    }

    function undoDeleteTask(id, listId) {
        batchUpdates(() => {
            taskTracker.update(id, {
                deleted: false,
                deletedDate: null
            }, { suppressUpdate: true });
            taskTracker.reorderList(listId, true);
            refreshTasks();
        });
    }

    function getListsSorted() {
        return listTracker.index
            .values()
            .filter(l => !l.deleted)
            .sort((a, b) => a.order - b.order);
    }

    function maintenance() {
        let tasks = taskTracker.index.values();
        let settings = get("settings") || {};
        let dirty = false;
        for (let task of tasks) {
            if (task.completed && task.completedDate && !task.deleted) {
                let cmp = Date.parse(task.completedDate);
                if (cmp + settings.deleteCompletedTasksAfterDays * OneDayMs < Date.now()) {
                    deleteTask(task);
                    dirty = true;
                }
            }

            if (task.deleted && Date.now() - Date.parse(task.deletedDate) > settings.purgeDeletedObjectsAfterDays * OneDayMs)
                taskTracker.delete(task.id);
        }
    }

    return {
        onInit() {
            this.addTrigger("refreshTasks", ["settings", "search"], refreshTasks, true);

            listTracker.start();
            taskTracker.start();
        },

        onDestroy() {
            listTracker.stop();
            taskTracker.stop();
        },

        onAddList(e) {
            if (e) e.preventDefault();
            let id = uid();
            listTracker.update(
                id, {
                    id: id,
                    name: "New List",
                    edit: true,
                    createdDate: new Date().toISOString(),
                    boardId: boardId,
                    order: getListsSorted().length
                });
        },

        onSaveList(e, { store }) {
            let list = store.get("$list");
            listTracker.update(list.id, {
                ...list,
                edit: false,
                lastChangeDate: new Date().toISOString()
            });
        },

        onDeleteList(e, { store }) {
            let list = store.get("$list"),
                id = list.id;
            listTracker.update(id, {
                deleted: true,
                deletedDate: new Date().toISOString(),
                edit: false
            }, { suppressUpdate: true });
            listTracker.reorder(true);
            listTracker.forceUpdate();

            showUndoToast(`List ${list.name} has been deleted`,
                () => this.undoDeleteList(id)
            );
        },

        undoDeleteList(id) {
            listTracker.update(id, {
                deleted: false,
                deletedDate: null
            }, { suppressUpdate: true });
            listTracker.reorder(true);
            listTracker.forceUpdate();
        },

        onSaveTask(task) {
            taskTracker.update(task.id, task);
        },

        onDeleteTask(task) {
            deleteTask(task);

            showUndoToast(`Task ${task.name} has been deleted.`,
                () => undoDeleteTask(task.id, task.listId));
        },

        onAddTask(e, { store }) {
            e.preventDefault();
            let listId = store.get("$list.id");
            let id = uid();
            taskTracker.add({
                id,
                name: null,
                listId,
                createdDate: new Date().toISOString(),
                order: 1e6
            }, { suppressUpdate: true, suppressSync: true }
            );
            taskTracker.reorderList(listId);
            editTask(id);
        },

              /** this will ad as substask to current task or subtask */
              addSubtaskTask(e, { store }) {
                      e.preventDefault();
                      let { $task } = store.getData();
                      let id = uid();
                      let taskList = tasks.get();
                      var sortedList = _.sortBy(taskList, "order");
                      let aboveId = getNotDeletedUpperTaskIdForList(sortedList, $task.id);
                      let aboveOrder = getNotDeletedUpperOrderIdForList(sortedList, $task.id);
                      let listId = store.get("$list.id");
                      let orderToInsert = store.get("$list.taskAddAsFirst");
                      let task = prepareTask(listId, aboveOrder, aboveId, orderToInsert);
                      tasks.append(task);
                      taskTracker.add({
                          id,
                          name: null,
                          listId,
                          createdDate: new Date().toISOString(),
                          order: orderToInsert
                      }, {
                          suppressUpdate: true,
                          suppressSync: true
                      });
                     taskTracker.reorderList(listId);
                     editTask(id);
                  },

                  addBelowAsMainSubtask(e, { store }) {
                      e.preventDefault();
                      let {
                          $task
                      } = store.getData();
                      let taskList = tasks.get();
                      let id = uid();
                      var sortedList = _.sortBy(taskList, "order");
                      let parentId = getMainIdAbove(sortedList, $task.id)
                      // getNotDeletedUpperTaskIdForList(sortedList, $task.id);
                      let aboveOrder = getNotDeletedUpperOrderIdForList(sortedList, $task.id);
                      let listId = store.get("$list.id");
                      let orderToInsert = store.get("$list.taskAddAsFirst");
                      let task = prepareTask(listId, aboveOrder, parentId, orderToInsert);
                      tasks.append(task);
                      taskTracker.add({
                          id,
                          name: null,
                          listId,
                          createdDate: new Date().toISOString(),
                          order: orderToInsert
                      }, {
                          suppressUpdate: true,
                          suppressSync: true
                      });
                     taskTracker.reorderList(listId);
                     editTask(id);
                  },

                  makeTaskSubtask(e, { store }) {
                      e.stopPropagation();
                      let { $task } = store.getData();
                      let taskList = tasks.get();
                      var sortedList = _.sortBy(taskList, "order");
                      let aboveId = getNotDeletedUpperTaskIdForList(sortedList, $task.id);
                      updateTask({
                          ...$task,
                          parentId: aboveId
                      });
                  },

                    //   const getSortedTasks = (listId,t) => {
                    //       let sortedList = _.sortBy(tasks.get(), "order");
                    //       return getTaskList(sortedList, t => t.listId == listId);
                    //   };

        moveTaskUp(e, { store }) {
            e.stopPropagation();
            e.preventDefault();
            let { $task } = store.getData();
            let visibleTasks = getVisibleListTasks($task.listId);
            let index = visibleTasks.indexOf($task);
            if (index > 0) {
                taskTracker.update(
                    $task.id,
                    {
                        order: visibleTasks[index - 1].order - 0.1
                    },
                    { suppressSync: true, suppressUpdate: true }
                );
                taskTracker.reorderList($task.listId);
            }
        },

        moveTaskDown(e, { store }) {
            e.stopPropagation();
            e.preventDefault();
            let { $task } = store.getData();
            let visibleTasks = getVisibleListTasks($task.listId);
            let index = visibleTasks.indexOf($task);
            if (index + 1 < visibleTasks.length) {
                taskTracker.update($task.id, {
                    order: visibleTasks[index + 1].order + 0.1
                }, { suppressSync: true, suppressUpdate: true });
                taskTracker.reorderList($task.listId);
            }
        },

        moveTaskLeft(e, { store }) {
            e.stopPropagation();
            e.preventDefault();
            let { $task } = store.getData();
            let lists = getListsSorted();
            let listIndex = lists.findIndex(a => a.id == $task.listId);
            if (listIndex > 0) {
                batchUpdatesAndNotify(() => {
                    taskTracker.moveTaskToList($task.id, lists[listIndex - 1].id);
                }, () => {
                    activateTask($task.id);
                });
            }
        },

        moveTaskRight(e, { store }) {
            e.stopPropagation();
            e.preventDefault();
            let { $task } = store.getData();
            let lists = getListsSorted();
            lists.sort((a, b) => a.order - b.order);
            let listIndex = lists.findIndex(a => a.id == $task.listId);
            if (listIndex + 1 < lists.length) {
                batchUpdatesAndNotify(() => {
                    taskTracker.moveTaskToList($task.id, lists[listIndex + 1].id);
                }, () => {
                    activateTask($task.id);
                })
            }
        },

        onTaskDrop(e, { store, data }) {
            let task = e.source.store.get("$task");
            let { order, listId } = data.data;

            taskTracker.update(task.id, {
                listId,
                order
            }, { suppressUpdate: true, suppressSync: true });

            taskTracker.reorderList(listId);

            if (listId != task.listId)
                taskTracker.reorderList(task.listId);
        },

        onListDrop(e, { store, data }) {
            let list = e.source.store.get("$list");
            let { order } = data.data;

            listTracker.update(list.id, {
                order
            }, { suppressSync: true, suppressUpdate: true });

            listTracker.reorder();
        },

        onTaskKeyDown(e, instance) {
            let { store } = instance;
            let {data} = instance;
            let t=data.task;
            let { $task } = store.getData();
            let code = c => c.charCodeAt(0);

            switch (e.keyCode) {
                case KeyCode.delete:
                case code("D"):
                    if (e.keyCode === code("D") && !e.shiftKey) return;

                    e.preventDefault();
                    e.stopPropagation();

                    this.onDeleteTask($task);

                    break;

                case KeyCode.insert:
                case code("O"):
                    e.preventDefault();
                    e.stopPropagation();

                    let offset = -0.1;
                    if (e.ctrlKey || (e.keyCode === code("O") && !e.shiftKey))
                        offset = +0.1;

                    let id = uid();
                    taskTracker.add({
                        id,
                        listId: $task.listId,
                        order: $task.order + offset,
                        createdDate: new Date().toISOString()
                    }, { suppressUpdate: true, suppressSync: true });
                    taskTracker.reorderList($task.listId);
                    editTask(id);
                    break;

                case KeyCode.up:
                    if (e.ctrlKey) this.moveTaskUp(e, instance);
                    break;

                case KeyCode.down:
                    if (e.ctrlKey) this.moveTaskDown(e, instance);
                    break;

                case KeyCode.right:
                    // if (e.ctrlKey) this.moveTaskRight(e, instance);
                      let st = prepereSubtaskTasks(prepareTask, t, getSortedTaskOrderList, $task, e, code);
                      set("activeTaskId", st.id);
                      this.addBelowAsMainSubtask(e, instance);
                    break;

                case KeyCode.left:
                    if (e.ctrlKey) this.moveTaskLeft(e, instance);
                    break;
            }
        },

        onTaskListKeyDown(e, instance) {
            let code = c => c.charCodeAt(0),
                list;

            switch (e.keyCode) {
                case code("K"):
                    if (e.currentTarget.previousSibling && e.currentTarget.previousSibling.previousSibling)
                        FocusManager.focusFirst(e.currentTarget.previousSibling.previousSibling);
                    break;

                case code("J"):
                    if (e.currentTarget.nextSibling && e.currentTarget.nextSibling.nextSibling)
                        FocusManager.focusFirst(e.currentTarget.nextSibling.nextSibling);
                    break;

                case KeyCode.left:
                case code("H"):
                case code("B"):
                    list = closest(e.target, el => el.classList.contains("cxb-tasklist"));
                    if (list.previousSibling && list.previousSibling.previousSibling)
                        FocusManager.focusFirst(list.previousSibling.previousSibling);
                    break;

                case KeyCode.right:
                case code("W"):
                case code("L"):
                    list = closest(e.target, el => el.classList.contains("cxb-tasklist"));
                    if (list.nextSibling && list.nextSibling.nextSibling)
                        FocusManager.focusFirst(list.nextSibling.nextSibling);
                    break;
            }
        },

        onMoveListLeft(e, { store }) {
            let { $list } = store.getData();
            let lists = getListsSorted();
            let index = lists.findIndex(l => l.id == $list.id);
            if (index > 0) {
                listTracker.update($list.id, {
                    order: lists[index - 1].order - 0.1
                }, { suppressUpdate: true, suppressSync: true });
                listTracker.reorder();
            }
        },

        onMoveListRight(e, { store }) {
            let { $list } = store.getData();
            let lists = getListsSorted();
            let index = lists.findIndex(l => l.id == $list.id);
            if (index + 1 < lists.length) {
                listTracker.update($list.id, {
                    order: lists[index + 1].order + 0.1
                }, { suppressUpdate: true, suppressSync: true });
                listTracker.reorder();
            }
        },

        onEditList(e, { store }) {
            e.preventDefault();
            listTracker.update(store.get("$list.id"), {
                edit: true
            });
        }
    };
};



function getTasksInNewOrder(prepareTask, t, getSortedTaskOrderList, $task, e, code) {
    let nt = prepareTask(t.listId);
    let order = getSortedTaskOrderList(t.listId,t);
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
