angular.module("proton.controllers.Settings")

.controller('UsersController', function(
    $rootScope,
    $scope,
    $translate,
    confirmModal,
    Member,
    members,
    organization,
    Organization,
    storageModal,
    userModal,
    notify
) {
    var MASTER = 2;
    var SUB = 1;
    var NORMAL = 0;

    $scope.roles = [
        {label: $translate.instant('MASTER'), value: MASTER},
        {label: $translate.instant('SUB'), value: SUB}
    ];

    $scope.initialization = function() {
        if(organization.data.Code === 1000) {
            $scope.organization = organization.data.Organization;
        }

        if(members.data.Code === 1000) {
            $scope.members = members.data.Members;
        }
    };

    $scope.addressesOf = function(member) {
        var addresses = [];

        _.each(member.AddressIDs, function(addressID) {
            var address = _.findWhere($scope.addresses, {AddressID: addressID});

            if(angular.isDefined(address)) {
                addresses.push(address);
            }
        });

        return addresses;
    };

    /**
     * Initialize select value with role user
     */
    $scope.initRole = function(member) {
        var role = _.findWhere($scope.roles, {value: member.Role});

        if(angular.isDefined(role)) {
            member.selectRole = role;
        }
    };

    /**
     * Inform the back-end to change member role
     * @param {Object} member
     */
    $scope.changeRole = function(member) {
        Member.role(member.ID, member.Role).then(function(result) { // TODO check request
            if(result.data && result.data.Code === 1000) {
                notify({message: $translate.instant('ROLE_UPDATED'), classes: 'notification-success'});
            } else if(result.data && result.data.Error) {
                notify({message: result.data.Error, classes: 'notification-danger'});
            } else {
                notify({message: $translate.instant('ERROR_DURING_UPDATING'), classes: 'notification-danger'});
            }
        }, function(error) {
            notify({message: $translate.instant('ERROR_DURING_UPDATING'), classes: 'notification-danger'});
        });
    };

    /**
     * Save the organization name
     */
    $scope.saveOrganizationName = function() {
        Organization.update({
            Organization: {
                DisplayName: $scope.organization.DisplayName
            }
        }).then(function(result) { // TODO omit some parameters
            if(result.data && result.data.Code === 1000) {
                notify({message: $translate.instant('ORGANIZATION_UPDATED'), classes: 'notification-success'});
            } else if(result.data && result.data.Error) {
                notify({message: result.data.Error, classes: 'notification-danger'});
            } else {
                notify({message: $translate.instant('ERROR_DURING_UPDATING'), classes: 'notification-danger'});
            }
        }, function(error) {
            notify({message: $translate.instant('ERROR_DURING_UPDATING'), classes: 'notification-danger'});
        });
    };

    /**
     * Unlink address
     * @param {Object} member
     * @param {Object} address
     */
    $scope.unlinkAddress = function(member, address) {
        var title = $translate.instant('UNLINK_ADDRESS');
        var message = 'Are you sure you want to unlink this address?'; // TODO translate

        confirmModal.activate({
            params: {
                title: title,
                message: message,
                confirm: function() {
                    // TODO
                    confirmModal.deactivate();
                },
                cancel: function() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Manage user's passwords
     * @param {Object} member
     */
    $scope.managePasswords = function(member) {

    };

    /**
     * Generate keys
     * @param {Object} member
     */
    $scope.generateKeys = function(member) {

    };

    /**
     * Open a new tab to access to a specific user's inbox
     * @param {Object} member
     */
    $scope.enterMailbox = function(member) {

    };

    /**
     * Remove member
     * @param {Object} member
     */
    $scope.remove = function(member) {
        var title = $translate.instant('REMOVE_MEMBER');
        var message = $translate.instant('ARE_YOU_SURE?');
        var index = $scope.members.indexOf(member);

        confirmModal.activate({
            params: {
                title: title,
                message: message,
                confirm: function() {
                    networkActivityTracker.track(Member.delete(member.ID).then(function(result) {
                        if(angular.isDefined(result.data) && result.data.Code === 1000) {
                            $scope.members.splice(index, 1); // Remove member in the members list
                            confirmModal.deactivate(); // Close the modal
                            notify({message: $translate.instant('USER_REMOVED'), classes: 'notification-success'}); // Display notification
                        } else if(angular.isDefined(result.data) && angular.isDefined(result.data.Error)) {
                            notify({message: result.data.Error, classes: 'notification-danger'});
                        } else {
                            notify({message: $translate.instant('ERROR_DURING_DELETION'), classes: 'notification-danger'});
                        }
                    }, function() {
                        notify({message: $translate.instant('ERROR_DURING_DELETION'), classes: 'notification-danger'});
                    }));
                },
                cancel: function() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Open modal to manage member's storage
     * @param {Object} member
     */
    $scope.manageStorage = function(member) {
        storageModal.activate({
            params: {
                member: member,
                submit: function() {
                    storageModal.deactivate();
                },
                cancel: function() {
                    storageModal.deactivate();
                }
            }
        });
    };

    /**
     * Provide a modal to create a new user
     */
    $scope.openUserModal = function() {
        userModal.activate({
            params: {
                submit: function(datas) {
                    userModal.deactivate();
                },
                cancel: function() {
                    userModal.deactivate();
                }
            }
        });
    };

    // Call initialization
    $scope.initialization();
});
