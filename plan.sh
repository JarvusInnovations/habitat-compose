pkg_name=habitat-compose
pkg_origin=jarvus
pkg_maintainer="Chris Alfano <chris@jarv.us>"
pkg_upstream_url="https://github.com/JarvusInnovations/habitat-compose"
pkg_license=("Apache-2.0")
pkg_build_deps=(jarvus/underscore)
pkg_deps=(core/node16)
pkg_bin_dirs=(bin)
pkg_svc_user="root"
pkg_svc_group="root"
pkg_svc_run="habitat-compose ${pkg_svc_config_path}/services.json"


pkg_version() {
  underscore extract version --outfmt text --in "${PLAN_CONTEXT}/package.json"
}

# implement build workflow
do_before() {
  do_default_before
  update_pkg_version
}

do_build() {
  pushd "${CACHE_PATH}" > /dev/null
  cp -v \
    "${PLAN_CONTEXT}/package.json" \
    "${PLAN_CONTEXT}/package-lock.json" \
    ./
  npm ci
  popd > /dev/null
}

do_install() {
  pushd "${CACHE_PATH}" > /dev/null
  cp -r ./* "${pkg_prefix}/"
  {
    echo "#!$(pkg_path_for core/node14)/bin/node"
    echo
    cat "${PLAN_CONTEXT}/habitat-compose.js"
  } > "${pkg_prefix}/bin/habitat-compose"
  chmod +x "${pkg_prefix}/bin/habitat-compose"
  popd > /dev/null
}
