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
  jarvus/habitat-compose

  # any services you want to bundle
  "${pkg_origin}/${composite_base_pkg_name}"
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

Or, bundle the whole build process up in one Dockerfile with optimized layering:

```Dockerfile
FROM jarvus/habitat-compose:latest as habitat
ARG HAB_LICENSE=no-accept
ENV HAB_LICENSE=$HAB_LICENSE
ENV STUDIO_TYPE=Dockerfile
ENV HAB_ORIGIN=myorigin
RUN hab origin key generate
# pre-layer all external runtime plan deps
COPY habitat/plan.sh /habitat/plan.sh
RUN hab pkg install \
    $({ cat '/habitat/plan.sh' && echo 'echo "${pkg_deps[@]/$pkg_origin\/*/}"'; } | hab pkg exec core/bash bash) \
    && hab pkg exec core/coreutils rm -rf /hab/{artifacts,src}/
# pre-layer all external runtime composite deps
COPY habitat/composite/plan.sh /habitat/composite/plan.sh
RUN hab pkg install \
    $({ cat '/habitat/composite/plan.sh' && echo 'echo "${pkg_deps[@]/$pkg_origin\/*/}"'; } | hab pkg exec core/bash bash) \
    && hab pkg exec core/coreutils rm -rf /hab/{artifacts,src}/


FROM habitat as builder
# pre-layer all build-time plan deps
RUN hab pkg install \
    core/hab-plan-build \
    $({ cat '/habitat/plan.sh' && echo 'echo "${pkg_build_deps[@]/$pkg_origin\/*/}"'; } | hab pkg exec core/bash bash) \
    && hab pkg exec core/coreutils rm -rf /hab/{artifacts,src}/
# pre-layer all build-time composite deps
RUN hab pkg install \
    $({ cat '/habitat/composite/plan.sh' && echo 'echo "${pkg_build_deps[@]/$pkg_origin\/*/}"'; } | hab pkg exec core/bash bash) \
    && hab pkg exec core/coreutils rm -rf /hab/{artifacts,src}/
# build application
COPY . /src
RUN hab pkg exec core/hab-plan-build hab-plan-build /src
RUN hab pkg exec core/hab-plan-build hab-plan-build /src/habitat/composite


FROM habitat as runtime
# install .hart artifact from builder stage
COPY --from=builder /hab/cache/artifacts/$HAB_ORIGIN-* /hab/cache/artifacts/
RUN hab pkg install /hab/cache/artifacts/$HAB_ORIGIN-* \
    && hab pkg exec core/coreutils rm -rf /hab/{artifacts,src}/


# configure persistent volumes
RUN hab pkg exec core/coreutils mkdir -p '/hab/svc/mysql/data' '/hab/svc/myapp/data' \
    && hab pkg exec core/coreutils chown hab:hab -R '/hab/svc/mysql/data' '/hab/svc/myapp/data'

VOLUME ["/hab/svc/mysql/data", "/hab/svc/myapp/data"]


# configure entrypoint
ENTRYPOINT ["hab", "sup", "run"]
CMD ["myorigin/myapp-composite"]

```
