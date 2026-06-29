export interface FsDir {
  type: 'dir';
  children: Record<string, FsNode>;
}

export interface FsFile {
  type: 'file';
  content: string;
}

export type FsNode = FsDir | FsFile;

/**
 * A small in-memory virtual filesystem that lives in the user's browser tab.
 * It's pre-populated with a friendly starting filesystem.
 */
export function createInitialFs(): FsDir {
  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          learner: {
            type: 'dir',
            children: {
              'welcome.txt': {
                type: 'file',
                content:
                  'Welcome to Learninx!\n\nThis is a safe in-browser terminal.\nTry: pwd, ls, mkdir, cat, echo, cd ..\n',
              },
              'README.md': {
                type: 'file',
                content:
                  '# ~/README.md\n\nLearn Linux by typing commands here.\nNo system changes will happen — everything is simulated.\n',
              },
            },
          },
        },
      },
      tmp: { type: 'dir', children: {} },
      etc: {
        type: 'dir',
        children: {
          hostname: { type: 'file', content: 'learninx-sandbox\n' },
          passwd: {
            type: 'file',
            content: 'learner:x:1000:1000:learner:/home/learner:/bin/bash\n',
          },
        },
      },
      var: { type: 'dir', children: {} },
      usr: {
        type: 'dir',
        children: {
          bin: { type: 'dir', children: {} },
          local: { type: 'dir', children: {} },
        },
      },
    },
  };
}
