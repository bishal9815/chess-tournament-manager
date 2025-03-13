const simpleGit = require('simple-git');
const path = require('path');

// Path to your local Git repository
const repoPath = path.resolve(__dirname); // Current directory

// Initialize simple-git with the repository path
const git = simpleGit(repoPath);

// Function to automate the Git process
async function autoCommitAndPush(commitMessage, branchName = 'main') {
  try {
    // Check if the directory is a Git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.error('This is not a Git repository.');
      return;
    }

    // Add all changes to the staging area
    console.log('Staging all changes...');
    await git.add('.'); // Equivalent to `git add .`

    // Commit the changes with the provided message
    console.log(`Committing changes with message: "${commitMessage}"`);
    await git.commit(commitMessage); // Equivalent to `git commit -m "message"`

    // Push the changes to the specified branch on the remote repository
    console.log(`Pushing changes to branch: ${branchName}`);
    await git.push('origin', branchName); // Equivalent to `git push origin <branch-name>`

    console.log('Changes successfully pushed to GitHub!');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Example usage
const commitMessage = 'Automated commit via Node.js script';
const branchName = 'main'; // Change this to your branch name if needed

autoCommitAndPush(commitMessage, branchName);