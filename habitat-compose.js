const process = require('process');
const hab = require('hab-client');


run();

async function run() {
    const services = require(`${process.argv[2]}/services.json`);
    const binds = require(`${process.argv[2]}/binds.json`);
    const exports = require(`${process.argv[2]}/exports.json`);
    console.log({ services, binds, exports });

    for (const serviceName in services) {
        const {
            pkg_origin=process.env.HAB_ORIGIN,
            pkg_name=serviceName
        } = services[serviceName];

        const pkg_ident = `${pkg_origin}/${pkg_name}`;

        console.log(`Loading service: ${pkg_ident}`);

        try {
            await hab.svc('load', { force: true }, pkg_ident);
        } catch (err) {
            console.error(`Failed to load service: ${err.message}`);
        }
    }
}
