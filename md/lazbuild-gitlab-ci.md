## Continuous Integration and Deployment for Lazarus Applications using Git on Windows 10

We use a GitLab [Continuous Integration][ci] script to build our Windows 10 application and deploy it to the internet for our users to download.

### Requirements

- [lazarus-ide](https://www.lazarus-ide.org/) - Our script depends on ` c:\\lazarus\\Lazbuild.exe` being installed on the system where you will register and run the GitLab-Runner.
- [GitLab-Runner](https://docs.gitlab.com/runner/install/windows.html) - Cross platform task runner that will execute the script, we only focus on Windows.
- The actual [`.gitlab-ci.yaml`](https://gitlab.com/profhound/inputlock/-/blob/master/.gitlab-ci.yml) script that tells gitlab what command to execute and what executable to upload as a [artifact](job_artifacts).

### The Script

```yaml
stages:
  - compile

release:
  stage: compile
  script:
    - c:\\lazarus\\Lazbuild.exe inputlock.lpi --build-mode=release
  artifacts:
    paths:
      - inputlock.exe
```

### Result

After the artifact has been uploaded you can give your users the following example url to download your latest application:

```
https://gitlab.com/<username>/<project_name>/-/jobs/artifacts/master/raw/<path_to_exe>?job=release
```

For our example script you can download the [latest executable][inputlock.exe] as follow:

```
C:\Users\d-_-b>curl https://gitlab.com/profhound/inputlock/-/jobs/artifacts/master/raw/inputlock.exe?job=release
<html><body>You are being <a href="https://gitlab.com/profhound/inputlock/-/jobs/491190627/artifacts/raw/inputlock.exe">redirected</a>.</body></html>
```

### Step Next

Have your application look if there is a new executable and download it automatically. 

You also don't have to rely on the `gitlab.com` infrastructure, but that rather [self-host][gitlab-on-ubuntu] on your own server.

[ci]: https://en.wikipedia.org/wiki/Continuous_integration
[job_artifacts]: https://docs.gitlab.com/ce/ci/pipelines/job_artifacts.html
[inputlock.exe]: https://gitlab.com/profhound/inputlock/-/jobs/artifacts/master/raw/inputlock.exe?job=release
[gitlab-on-ubuntu]: https://www.linode.com/docs/development/version-control/install-gitlab-on-ubuntu-18-04/
