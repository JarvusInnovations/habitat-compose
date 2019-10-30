# habitat-compose
A plan and pattern for deploying groups of Habitat services

## Example Usage

### Initialize `habitat/composite/plan.sh`

Just change `myapp` and `myorigin` to create this thin wrapper service around your `myapp` service:

```bash
composite_base_pkg_name=myapp
pkg_name="${composite_base_pkg_name}-composite"
pkg_origin=myorigin
pkg_maintainer="First Last <me@example.org>"
pkg_build_deps=(
  jarvus/toml-merge
)
pkg_deps=(
  "${pkg_origin}/${composite_base_pkg_name}"
  jarvus/habitat-compose
  core/postgresql11
  emergence/nginx/1.15.6/20191009041933
)

pkg_svc_user="root"
pkg_svc_run="habitat-compose ${pkg_svc_config_path}/services.json"


pkg_version() {
  echo "$(pkg_path_for ${pkg_origin}/${composite_base_pkg_name})" | cut -d / -f 6
}

# implement build workflow
do_before() {
  do_default_before
  update_pkg_version
}

do_build() {
  return 0
}

do_install() {
  return 0
}

do_build_config() {
  do_default_build_config

  build_line "Merging habitat-compose config"
  cp -nrv "$(pkg_path_for jarvus/habitat-compose)/config" "${pkg_prefix}/"
  toml-merge \
    "$(pkg_path_for jarvus/habitat-compose)/default.toml" \
    "${PLAN_CONTEXT}/default.toml" \
    > "${pkg_prefix}/default.toml"
}

do_strip() {
  return 0
}
```

### Initialize `habitat/composite/default.toml`

Map out the services you want and their binds:

```toml
[services.postgresql]
  pkg_ident = "core/postgresql11"

[services.myapp]
  # pkg_origin can be inherited from the composite service's origin
  pkg_name = "myapp"
  [services.myapp.binds]
    database = "postgresql"

[services.nginx]
  pkg_ident = "emergence/nginx"
  [services.nginx.binds]
    runtime = "myapp"
```

### Building packages and composite docker container

Use a reused studio to build a composite Habitat service you can export to a Docker contaire with Habitat:

```bash
export HAB_ORIGIN="myorigin"

hab pkg build ./myapp
hab pkg build --reuse ./myapp/habitat/composite
env $(cat results/last_build.env | xargs) bash -c 'hab pkg export docker results/${pkg_artifact}'
```
