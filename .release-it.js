module.exports = {
  "plugins": {
    "@release-it/conventional-changelog": {
      "infile": "CHANGELOG.md",
      "preset": {
        "name": "conventionalcommits",
        "types": [
          { "type": "feat", "section": "Features:" },
          { "type": "fix", "section": "Bug Fixes:" },
          { "type": "chore", "section": "Chore:" },
          { "type": "docs", "section": "Docs:" },
          { "type": "style", "section": "Style:" },
          { "type": "refactor", "section": "Refactor:" },
          { "type": "perf", "section": "Performance:" },
          { "type": "test", "section": "Test:" }
        ]
      }
    }
  },
  "hooks": {
    "after:bump": "npm run build",
    "after:release": "echo Successfully released ${name} v${version} to ${repo.repository}."
  },
  "git": {
    "push": true,
    "requireCleanWorkingDir": false,
    "requireUpstream": false,
    "requireCommits": true,
    "addUntrackedFiles": false,
    "commit": true,
    "commitMessage": "chore: release v${version}",
    "commitArgs": "",
    "tag": true,
    "tagName": "${version}",
    "tagAnnotation": "Release v${version}",
    "tagArgs": "",
    "pushArgs": "--follow-tags",
    "pushRepo": "origin",
    "changelog": true
  },
  "github": {
    "release": true,
    "releaseName": "Release v${version}",
    "releaseNotes": null,
    "preRelease": false,
    "draft": false,
    "tokenRef": "GITHUB_TOKEN"
  },
  "npm": {
    "publish": true,
  }
}
