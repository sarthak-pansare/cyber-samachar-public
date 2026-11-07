export function shouldBuildBranch(appEnv, branchName) {
  const environment = String(appEnv || '').trim().toLowerCase();
  const branch = String(branchName || '').trim();

  if (environment === 'development') {
    return branch === 'develop'
      || branch.startsWith('feature/')
      || branch.startsWith('hotfix/');
  }
  if (environment === 'qa') return branch === 'qa';
  if (environment === 'staging') return branch === 'staging';
  if (environment === 'production') return branch === 'main';
  return false;
}
