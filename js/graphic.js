var pymChild = null,
    mobileThreshold = 300, //set to 500 for testing
    aspect_width = 4,
    aspect_height = 10;

var $map = $('#map');

var margin = {
    top: 10,
    right: 0,
    bottom: 10,
    left: 10,
};

var circleRange = [3,75];

var colors = {
    'red1': '#6C2315', 'red2': '#A23520', 'red3': '#D8472B', 'red4': '#E27560', 'red5': '#ECA395', 'red6': '#F5D1CA',
    'orange1': '#714616', 'orange2': '#AA6A21', 'orange3': '#E38D2C', 'orange4': '#EAAA61', 'orange5': '#F1C696', 'orange6': '#F8E2CA',
    'yellow1': '#77631B', 'yellow2': '#B39429', 'yellow3': '#EFC637', 'yellow4': '#F3D469', 'yellow5': '#F7E39B', 'yellow6': '#FBF1CD',
    'teal1': '#0B403F', 'teal2': '#11605E', 'teal3': '#17807E', 'teal4': '#51A09E', 'teal5': '#8BC0BF', 'teal6': '#C5DFDF',
    'blue1': '#28556F', 'blue2': '#3D7FA6', 'blue3': '#51AADE', 'blue4': '#7DBFE6', 'blue5': '#A8D5EF', 'blue6': '#D3EAF7'
};

/*
 * Render the graphic
 */
//check for svg
function draw_graphic(){
    if (Modernizr.svg){
        $map.empty();
        var width = $map.width();
        render(width);
        window.onresize = draw_graphic; //very important! the key to responsiveness
    }
}

function render(width) {

    var height = .88 * width;

    widthKey = 130;
    width = width - widthKey;

    console.log("object width = " + width);

    var  projection = d3.geo.mercator()
        .scale(width*18)
        .center([-123.7527, 38.9082]) //center of bay
        .translate([margin.left,margin.top]);

    var path = d3.geo.path()
        .projection(projection);

    var svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

    //global for console
    var myObj = {};

    //format for tooltip
    var format = function(d){
        if (d) { return (d3.format("$,f"))(d) }
        else { return "None"}
        }
    //pre load data in csvs
    queue()
        .defer(d3.json, "counties.json")
        .defer(d3.csv, "defense2.csv")
        .defer(d3.csv, "2013_bay_counties.csv")
        .await(ready);

    //declare empty objects. later fill them with key value pairs
    var rateByCounty = {};
    var crimePerPop = {};

    function ready(error, ca, defense, crime){
        //create key:value pairs from csvs
        defense.forEach(function(d) { 
            rateByCounty[d.county] = +d.value;})

        crime.forEach(function(d) {
            crimePerPop[d.lowercase] = (+d.violent_crimes / +d.population) * 10000; });

        mapData = topojson.feature(ca, ca.objects.subunits);

        //map lesso data onto mapData
        var areas = mapData.features.map(
            function(d) {return rateByCounty[d.properties.name.toUpperCase()];})

        //scale for circle
        var scale = d3.scale.sqrt()
            .domain(d3.extent(areas))
            .range(circleRange);

        //bind feature data to the map
        svg.selectAll(".subunit")
              .data(mapData.features)
            .enter().append("path")
            .attr("class", function(d) { 

                if (d.properties.name.toUpperCase() in rateByCounty) {
                return "subunit " + d.properties.name + " bayArea"; }
                else {
                return "subunit " + d.properties.name;
                }})
            .attr("d", path);

        //exterior border
        svg.append("path")
            .datum(topojson.mesh(ca, ca.objects.subunits, function(a, b) { return a === b;}))
            .attr("d", path)
            .attr("class", "exterior-boundary");

        //tooltip declaration
        var div = d3.select("#map").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        //function to assign colors to shapes
        var color = d3.scale.threshold() //colorscale
            .domain([250000, 500000, 750000, 1000000, 1500000, 2000000])
            .range(colorbrewer.Greens[7]);    

        //circles
        svg.append("g")
              .attr("class", "circles")
            .selectAll("circle")
                  .data(topojson.feature(ca, ca.objects.subunits).features)
                .enter().append("circle")
                    .attr("transform", function(d) { return 'translate(' + path.centroid(d) + ')';})
                  .attr("r", function(d) { return scale(rateByCounty[d.properties.name.toUpperCase()]); })
            .style("fill", function(d){ 
                var string = d.properties.name;
                upper = string.toUpperCase();
                return color(rateByCounty[upper]);
              })
                .on("mouseover", function(d){ //tooltip
                    div.transition()
                        .duration(200)
                        .style("opacity", .9);
                    div.html(d.properties.fullName + "<p>" + "Total Value: " + format(rateByCounty[d.properties.name.toUpperCase()]))//warning this is an approximation
                        .style("left", (d3.event.pageX) + 10 + "px")
                        .style("top", (d3.event.pageY - 30) + "px"); 
                })
                .on("mouseout", function(d) { 
                    div.transition()
                        .duration(500)
                        .style("opacity", 0.0);
                });      

    //max of 1033 cash
    var max = d3.max(defense, function(d) { return +d.value; });  


    //format for legend
    var truncate = function(d) { 
            return '$' + (d/1000000) + " m";
        };

    //key position encoding for legend
    var y = d3.scale.linear()
        .domain([0, max]) //input data
        .range([0, .75 * height]); //height of the key


    //create group for color bar and append data
    var colorBar = d3.select("#map").append("svg")
        .attr("class", "key-box")
        .attr("width", widthKey-margin.left)
        .attr("height", height)
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")") //position w/in svg
            .append("g")
                .attr("class", "key")
                .attr("transform", "translate(" + (.25 * widthKey) + "," + margin.top * 2 + ")")
                .selectAll("rect")
                .data(color.range().map(function(col) {
                    var d = color.invertExtent(col);
                    if (d[0] == null) d[0] = y.domain()[0];
                    if (d[1] == null) d[1] = y.domain()[1];
                    return d;
                }));

    //create color rects
    colorBar.enter()
        .append("rect")
            .attr("width", 40)
            .attr("y", function(d) { 
                return y(d[0]); })
            .attr("height", function(d) { 
                return y(d[1]) - y(d[0]); })
            .attr("fill", function(d) { return color(d[1]); });

    //get array of legend domain
    var colorDomain = color.domain();

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("right")
        .tickSize(40)
        .tickValues([colorDomain[1], colorDomain[3], colorDomain[5]])
        .tickFormat(truncate);

    //console.log(format(max));

    //add label
    d3.select(".key")
        .call(yAxis)
        .append("text")
            .attr("class", "label")
        .attr("y", -5)
        .attr("x", 25)//centers label on key
        .text("Cash Value of Gear")
        ;



    /////////interactivity below////////
    //delay function for transitions
    var delay = function(d, i){ return i * 25;};
    //crime button
    d3.select("#crime").on("click", function(){
        divFormat = d3.format("f");
        //map crime data to places
        var crimeArea = mapData.features.map(function(d){
            return crimePerPop[d.properties.name];
        });

        var crimeScale = d3.scale.sqrt()
            .domain(d3.extent(crimeArea))
            .range(circleRange);

        d3.selectAll("circle").transition()
            //set size of circle according to scale applied to the crime data object, called up by the topojson names
            .attr("r", function(d) { 
                return crimeScale(crimePerPop[d.properties.name]); })
            .delay(delay);

        //set mouseovers
        d3.selectAll("circle")
            .on("mouseover", function(d) {
                div.transition().duration(1000)
                    .style("opacity", 0.9);
                div.html(d.properties.fullName + "<p>Value of Military Gear: " + format(rateByCounty[d.properties.name.toUpperCase()]) + "</p><p> Violent Crimes / 10k People: " + (divFormat(crimePerPop[d.properties.name])) + "</p>")
                .style("left", (d3.event.pageX) + 10 + "px")
                .style("top", (d3.event.pageY) - 30 + "px");
            })
            .on("mouseout", function(d) {
                div.transition()
                    .duration(300)
                    .style("opacity", 0.0);
            });
    });//end of button selection

    //1033 cash button
    d3.select("#cash").on("click", function(d){ 
        d3.selectAll("circle").transition()
            .attr("r", function(d) { 
                return scale(rateByCounty[d.properties.name.toUpperCase()]);
            delay(delay);

            d3.selectAll("circle")
                div.transition().duration(1000)
                    .style("opacity", .9);
                div.html(d.properties.fullName + "<p>" + "Total Value: " + format(rateByCounty[d.properties.name.toUpperCase()]))//warning this is an approximation
                    .style("left", (d3.event.pageX) + 10 + "px")
                    .style("top", (d3.event.pageY - 30) + "px"); }) 
                .on("mouseout", function(d) { 
                    div.transition()
                        .duration(500)
                        .style("opacity", 0.0);
                });        

    });//end of button selection

    //end of ready function
    }




    //send height to parent AFTER chart is built
    if (pymChild) {
        pymChild.sendHeightToParent();
    }

//end function render    
}
/*
 * NB: Use window.load instead of document.ready
 * to ensure all images have loaded
 */
$(window).load(function() {
    if (Modernizr.svg){
        pymChild = new pym.Child({
            renderCallback: draw_graphic()
        });
    }
    else { pymChild = new pym.Child();
    }
})






