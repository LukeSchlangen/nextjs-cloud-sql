'use client'
import React, { useEffect, useState } from "react";
import { addNewTaskToDatabase, getTasksFromDatabase, deleteTaskFromDatabase, updateTaskInDatabase } from "./actions";

type Task = {
  id: string;
  title: string;
  status: 'IN_PROGRESS' | 'COMPLETE';
};

export default function Home() {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);

  async function getTasks() {
    const updatedListOfTasks = await getTasksFromDatabase();
    setTasks(updatedListOfTasks);
  }

  useEffect(() => {
    getTasks();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await addNewTaskToDatabase(newTaskTitle);
    await getTasks();
    setNewTaskTitle('');
  };

  async function updateTask(task: Task, newTaskValues: Partial<Task>) {
    await updateTaskInDatabase({ ...task, ...newTaskValues });
    await getTasks();
  }

  async function deleteTask(taskId: string) {
    await deleteTaskFromDatabase(taskId);
    await getTasks();
  }

  return (
    <main className="p-4">
      <h2 className="text-2xl font-bold mb-4">To Do List</h2>
      <div className="flex mb-4">
        <form onSubmit={handleSubmit} className="flex mb-8">
          <input
            type="text"
            placeholder="New Task Title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="flex-grow border border-gray-400 rounded px-3 py-2 mr-2 bg-inherit"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-nowrap"
          >
            Add New Task
          </button>
        </form>
      </div>
      <table className="w-full">
        <tbody>
          {tasks.map(function (task) {
            const isComplete = task.status === 'COMPLETE';
            return (
              <tr key={task.id} className="border-b border-gray-200">
                <td className="py-2 px-4">
                  <input
                    type="checkbox"
                    checked={isComplete}
                    onClick={() => updateTask(task, { status: isComplete ? 'IN_PROGRESS' : 'COMPLETE' })}
                    className="transition-transform duration-300 ease-in-out transform scale-100 checked:scale-125 checked:bg-green-500"
                  />
                </td>
                <td className="py-2 px-4">
                  <span
                    className={`transition-all duration-300 ease-in-out ${isComplete ? 'line-through text-gray-400 opacity-50' : 'opacity-100'}`}
                  >
                    {task.title}
                  </span>
                </td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded float-right"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}