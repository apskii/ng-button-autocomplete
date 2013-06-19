angular
    .module('ng-button-autocomplete', [])
    .directive('ngButtonAutocomplete', function () { return {
        restrict: 'AE',
        replace: true,
        template: '<div><input type="text"><button type="button" class="btn"><i class="icon-search"></i></button></div>',
        scope: {
            source: '&',
            value: '='
        },
        link: function ($scope, $elem, $attr) {
            var input  = $($elem.children()[0]),
                button = $($elem.children()[1]);
            $scope.$watch('value', function (val) {
                input.val(val);
            });
            input.autocomplete({
                source: $scope.source(),
                select: function (event, ui) {
                    $scope.$apply(function () {
                        $scope.value = ui.item.value;
                    });
                },
                close: function () {
                    input.autocomplete('option', 'minLength', 9999);
                },
                minLength: 9999
            });
            button.click(function () {
                input.autocomplete('option', 'minLength', 0);
                input.autocomplete('search', input.val());
            });
        }
    };});
