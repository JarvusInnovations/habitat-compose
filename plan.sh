pkg_name=habitat-compose
pkg_origin=jarvus
pkg_version="0.1.0"
pkg_maintainer="Chris Alfano <chris@jarv.us>"
pkg_license=("Apache-2.0")
pkg_deps=(core/hab-sup core/node)
pkg_bin_dirs=(bin)


do_build() {
  pushd "${CACHE_PATH}" > /dev/null
  cp -v \
    "${PLAN_CONTEXT}/package.json" \
    "${PLAN_CONTEXT}/package-lock.json" \
    ./
  npm install
  popd > /dev/null
}

do_install() {
  pushd "${CACHE_PATH}" > /dev/null
  cp -r ./* "${pkg_prefix}/"
  {
    echo "#!$(pkg_path_for core/node)/bin/node"
    echo
    cat "${PLAN_CONTEXT}/habitat-compose.js"
  } > "${pkg_prefix}/bin/habitat-compose"
  chmod +x "${pkg_prefix}/bin/habitat-compose"
  popd > /dev/null
}

do_build_service() {
  pkg_svc_run="habitat-compose ${pkg_svc_config_path}"
  do_default_build_service
}
