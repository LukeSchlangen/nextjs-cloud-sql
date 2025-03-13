# How to connect a Next.js application on Cloud Run to a Cloud SQL for PostgreSQL database

## Overview

The [Cloud SQL Node.js connector](https://github.com/GoogleCloudPlatform/cloud-sql-nodejs-connector#readme) is the easiest way to securely connect your Node.js application to your Cloud SQL database. [Cloud Run](https://cloud.google.com/run) is a fully managed serverless platform that enables you to run stateless containers that are invocable via HTTP requests. This Codelab will demonstrate how to connect a Node.js application on Cloud Run to a Cloud SQL for PostgreSQL database securely with a service account using IAM Authentication.

### Environment Setup

1. Set the project id

    ```
    gcloud config set project [your-project-id-goes-here]
    ```

    Example:
    ```
    gcloud config set project my-project-id
    ```

1. Enable the APIs:

    ```
    gcloud services enable compute.googleapis.com sqladmin.googleapis.com \
    run.googleapis.com artifactregistry.googleapis.com \
    cloudbuild.googleapis.com servicenetworking.googleapis.com
    ```

## Set up a Service Account

Create and configure a Google Cloud service account to be used by Cloud Run so that it has the correct permissions to connect to Cloud SQL.

1. Run the `gcloud iam service-accounts create` command as follows to create a new service account:

    ```
    gcloud iam service-accounts create quickstart-service-account \
      --display-name="Quickstart Service Account"
    ```

1. Run the gcloud projects add-iam-policy-binding command as follows to add the **Cloud SQL Client** role to the Google Cloud service account you just created. In Cloud Shell, the expression `${GOOGLE_CLOUD_PROJECT}` will be replaced by the name of your project. You can also do this replacement manually if you feel more comfortable with that.

    ```
    gcloud projects add-iam-policy-binding ${GOOGLE_CLOUD_PROJECT} \
      --member="serviceAccount:quickstart-service-account@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
      --role="roles/cloudsql.client"
    ```

1. Run the gcloud projects add-iam-policy-binding command as follows to add the **Cloud SQL Instance User** role to the Google Cloud service account you just created.

    ```
    gcloud projects add-iam-policy-binding ${GOOGLE_CLOUD_PROJECT} \
      --member="serviceAccount:quickstart-service-account@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
      --role="roles/cloudsql.instanceUser"
    ```

1. Run the gcloud projects add-iam-policy-binding command as follows to add the **Log Writer** role to the Google Cloud service account you just created.

    ```
    gcloud projects add-iam-policy-binding ${GOOGLE_CLOUD_PROJECT} \
      --member="serviceAccount:quickstart-service-account@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
      --role="roles/logging.logWriter"
    ```


## Set up Cloud SQL

Run the `gcloud sql instances create` command to create a Cloud SQL instance.

  ```
  gcloud sql instances create quickstart-instance \
    --database-version=POSTGRES_14 \
    --cpu=1 \
    --memory=4GB \
    --region=us-central1 \
    --database-flags=cloudsql.iam_authentication=on
  ```

This command may take a few minutes to complete.

Run the `gcloud sql databases create` command to create a Cloud SQL database within the `quickstart-instance`.

```
gcloud sql databases create quickstart_db \
  --instance=quickstart-instance
```

Create a PostgreSQL database user for the service account you created earlier
to access the database.

```
gcloud sql users create quickstart-service-account@${GOOGLE_CLOUD_PROJECT}.iam \
  --instance=quickstart-instance \
  --type=cloud_iam_service_account
```

## Prepare Application

Prepare a Next.js application that responds to HTTP requests.

1. To create a new Next.js project named `to-do-tracker`, use the command:
    ```
    npx create-next-app@15.1.0 to-do-tracker \
      --ts \
      --eslint \
      --tailwind \
      --no-src-dir \
      --turbopack \
      --app \
      --no-import-alias
    ```

1. If asked to install `create-next-app`, press `Enter` to proceed:

    ```
    Need to install the following packages:
    create-next-app@15.1.0
    Ok to proceed? (y)
    ```

1. Change directory into `to-do-tracker`:

    ```
    cd to-do-tracker
    ```

1. Install `pg` to interact with the PostgreSQL database.

    ```
    npm install pg @google-cloud/cloud-sql-connector google-auth-library
    ```

1. Install `@types/pg` as a dev dependency to use TypeScript Next.js application.

    ```
    npm install --save-dev @types/pg
    ```

1. Create the `actions.ts` file.

    ```
    touch app/actions.ts
    ```

1.  Open the `actions.ts` file in Cloud Shell Editor:

    ```
    cloudshell edit app/actions.ts
    ```

    An empty file should now appear in the top part of the screen. This is where you can edit this `actions.ts` file.
    <img src="img/code-goes-here.png" alt="Show that code goes in the top section of the screen" width="480.00" />

1. Copy the following code and paste it into the opened `actions.ts` file:
    ```
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
    ```

1.  Open the `page.tsx` file in Cloud Shell Editor:

    ```
    cloudshell edit app/page.tsx
    ```

    An existing file should now appear in the top part of the screen. This is where you can edit this `page.tsx` file.
    <img src="img/code-goes-here.png" alt="Show that code goes in the top section of the screen" width="480.00" />

1. Delete the existing contents of the `page.tsx` file.

1. Copy the following code and paste it into the opened `page.tsx` file:
    ```
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
    ```

The application is now ready to be deployed.


## Deploy Cloud Run Application

Run the command below to deploy your application to Cloud Run:

```
gcloud run deploy to-do-tracker \
  --region=us-central1 \
  --source=. \
  --service-account="quickstart-service-account@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
  --allow-unauthenticated
```

If prompted, press `y` and `Enter` to confirm that you would like to continue:

```console
Do you want to continue (Y/n)? y
```

After a few minutes, the application should provide a URL for you to visit.
