'use server'
import pg from 'pg';
import { AuthTypes, Connector } from '@google-cloud/cloud-sql-connector';
import { GoogleAuth } from 'google-auth-library';
const auth = new GoogleAuth();

const { Pool } = pg;

type Task = {
  id: string;
  title: string;
  status: 'IN_PROGRESS' | 'COMPLETE';
};

const projectId = await auth.getProjectId();

const connector = new Connector();
const clientOpts = await connector.getOptions({
  instanceConnectionName: `${projectId}:us-central1:quickstart-instance`,
  authType: AuthTypes.IAM,
});

const pool = new Pool({
  ...clientOpts,
  user: `quickstart-service-account@${projectId}.iam`,
  database: 'quickstart_db',
});

const tableCreationIfDoesNotExist = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL NOT NULL,
      created_at timestamp NOT NULL,
      status VARCHAR(255) NOT NULL default 'IN_PROGRESS',
      title VARCHAR(1024) NOT NULL,
      PRIMARY KEY (id)
    );`);
}

// CREATE
export async function addNewTaskToDatabase(newTask: string) {
  await tableCreationIfDoesNotExist();
  await pool.query(`INSERT INTO tasks(created_at, status, title) VALUES(NOW(), 'IN_PROGRESS', $1)`, [newTask]);
  return;
}

// READ
export async function getTasksFromDatabase() {
  await tableCreationIfDoesNotExist();
  const { rows } = await pool.query(`SELECT id, created_at, status, title FROM tasks ORDER BY created_at DESC LIMIT 100`);
  return rows;
}

// UPDATE
export async function updateTaskInDatabase(task: Task) {
  await tableCreationIfDoesNotExist();
  await pool.query(
    `UPDATE tasks SET status = $1, title = $2 WHERE id = $3`,
    [task.status, task.title, task.id]
  );
  return;
}

// DELETE
export async function deleteTaskFromDatabase(taskId: string) {
  await tableCreationIfDoesNotExist();
  await pool.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
  return;
}
