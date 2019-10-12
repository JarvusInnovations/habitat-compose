const process = require('process');
const hab = require('hab-client');
const toposort = require('toposort');
const TOML = require('@iarna/toml');


// run main function
run();

async function run() {

    // read loaded services
    const loadedServiceNames = [];
    const loadedServicePackageIdents = {};
    for (const loadedService of await hab.getServices()) {
        const [serviceName, serviceGroup] = loadedService.service_group.split(/\./);

        if (serviceGroup == 'compose') {
            loadedServiceNames.push(serviceName);
            loadedServicePackageIdents[serviceName] = loadedService.pkg.ident;
        }
    }


    // read configured services
    const services = require(process.argv[2]);


    // pre-load list of services for sorting
    const bindingEdges = [];

    for (const serviceId in services) {
        const service = services[serviceId];

        if (!service.name) {
            service.id = serviceId;
        }

        // fill out package details
        if (!service.pkg_ident) {
            const {
                pkg_origin = process.env.HAB_ORIGIN,
                pkg_name = serviceId
            } = service;

            service.pkg_ident = `${pkg_origin}/${pkg_name}`;
        }

        if (!service.pkg_name) {
            [,service.pkg_name] = service.pkg_ident.split(/\//);
        }

        // determine binds
        for (const bindName in service.binds) {
            const bindServiceId = service.binds[bindName];
            const bindService = services[bindServiceId];

            if (!bindService) {
                console.error(`bound service '${bindServiceId} not found for service '${serviceId}'`);
                process.exit(1);
            }

            bindingEdges.push([bindService, service]);
        }
    }


    // sort services by bind requirements
    const sortedServices = toposort.array(Object.values(services), bindingEdges);
    const sortedServiceNames = sortedServices.map(service => service.pkg_name);


    // unload orphan services
    const orphanServiceNames = loadedServiceNames.filter(serviceName => sortedServiceNames.indexOf(serviceName) == -1);

    for (const serviceName of orphanServiceNames) {
        const pkg_ident = loadedServicePackageIdents[serviceName];

        console.error(`Unloading service ${pkg_ident}`);

        try {
            await hab.svc('unload', pkg_ident);
        } catch (err) {
            console.error(`Failed to unload service: ${err.message}`);
        }
    }


    // load services via supervisor
    const time = Date.now();

    for (const { pkg_name, pkg_ident, binds, config } of sortedServices) {
        console.error(`Loading service ${pkg_ident}`);

        const bindArgs = [];
        for (const bindId in binds) {
            const bindServiceName = services[binds[bindId]].pkg_name;
            console.error(`\tBinding ${bindId}:${bindServiceName}`)
            bindArgs.push({ bind: `${bindId}:${bindServiceName}.compose` });
        }

        try {
            await hab.svc('load', pkg_ident, {
                group: 'compose',
                force: true,
                strategy: 'at-once'
            }, ...bindArgs);
        } catch (err) {
            console.error(`Failed to load service: ${err.message}`);
        }


        // apply configuration
        if (config) {
            console.error(`\tConfiguring service ${pkg_name}.compose`);

            try {
                const configApply = await hab.config('apply', `${pkg_name}.compose`, time, { $spawn: true, $nullOnError: true });
                await configApply.captureOutput(TOML.stringify(config));
            } catch (err) {
                console.error(`Failed to apply config: ${err.message}`);
            }
        }
    }


    // chill out and keep the process open until killed
    setInterval(() => {}, 1 << 30);
}
