elements = {}
connectors = {}
diagrams = {}

function extractTaggedValue(xmlElement, tag) {
    // extract information from the tagged values
    var taggedValueRoot = xmlElement.getElementsByTagName('UML:ModelElement.taggedValue')
    var taggedValues = taggedValueRoot[0].getElementsByTagName('UML:TaggedValue')
    for (var j = 0; j < taggedValues.length; j++) {
        var taggedValue = taggedValues[j];
        if (taggedValue.getAttribute('tag') == tag) {
            tv = taggedValue.getAttribute('value');
            break
        }
    }
    return tv
}

function extractPackages(xmlDoc) {
    var xmlelements = xmlDoc.getElementsByTagName('UML:Package')
    var elements = {}

    for (var i = 0; i < xmlelements.length; i++) {
        var xmlelement = xmlelements[i];
        if (xmlelement.getAttribute('isRoot') == 'false') {
            // extract basic information
            item = {}
            item.name = xmlelement.getAttribute('name')
            item.id = xmlelement.getAttribute('xmi.id')

            // extract information from the tagged values
            item.parentid = extractTaggedValue(xmlelement, 'parent');

            // add the information to the classes dictionary
            elements[item.id] = item
        }
    }

    return elements
}

function extractClasses(xmlDoc) {
    var xmlelements = xmlDoc.getElementsByTagName('UML:Class')
    var elements = {}

    for (var i = 0; i < xmlelements.length; i++) {
        var xmlelement = xmlelements[i];
        if (xmlelement.getAttribute('isRoot') == 'false') {
            // extract basic information
            item = {}
            item.name = xmlelement.getAttribute('name')
            item.id = xmlelement.getAttribute('xmi.id')

            // extract information from the tagged values
            item.owner = extractTaggedValue(xmlelement, 'owner');
            item.type = extractTaggedValue(xmlelement, 'ea_stype');
            item.packageid = extractTaggedValue(xmlelement, 'package');

            // add the information to the classes dictionary
            elements[item.id] = item
        }
    }

    return elements
}

function extractComponents(xmlDoc) {
    var xmlelements = xmlDoc.getElementsByTagName('UML:Component')
    var elements = {}

    for (var i = 0; i < xmlelements.length; i++) {
        var xmlelement = xmlelements[i];
        if (xmlelement.getAttribute('isRoot') == 'false') {
            // extract basic information
            item = {}
            item.name = xmlelement.getAttribute('name')
            item.id = xmlelement.getAttribute('xmi.id')

            // extract information from the tagged values
            item.type = extractTaggedValue(xmlelement, 'ea_stype');
            item.packageid = extractTaggedValue(xmlelement, 'package');

            // add the information to the classes dictionary
            elements[item.id] = item
        }
    }

    return elements
}

function extractActors(xmlDoc) {
    var xmlelements = xmlDoc.getElementsByTagName('UML:Actor')
    var elements = {}

    for (var i = 0; i < xmlelements.length; i++) {
        var xmlelement = xmlelements[i];
        if (xmlelement.getAttribute('isRoot') == 'false') {
            // extract basic information
            item = {}
            item.name = xmlelement.getAttribute('name')
            item.id = xmlelement.getAttribute('xmi.id')

            // extract information from the tagged values
            item.owner = extractTaggedValue(xmlelement, 'owner');
            item.type = extractTaggedValue(xmlelement, 'ea_stype');
            item.packageod = extractTaggedValue(xmlelement, 'package');

            // add the information to the classes dictionary
            elements[item.id] = item
        }
    }

    return elements
}

function processContents(xmlDoc) {
    packages = extractPackages(xmlDoc)
    console.log("Imported " + Object.keys(packages).length + " packages")
    for (var key in packages) {
        console.log(" > " + packages[key].name)
    }

    classes = extractClasses(xmlDoc)
    console.log("Imported " + Object.keys(classes).length + " classes")
    for (var key in classes) {
        console.log(" > " + classes[key].name)
    }

    components = extractComponents(xmlDoc)
    console.log("Imported " + Object.keys(components).length + " components")
    for (var key in components) {
        console.log(" > " + components[key].name)
    }

    actors = extractActors(xmlDoc)
    console.log("Imported " + Object.keys(actors).length + " actors")
    for (var key in actors) {
        console.log(" > " + actors[key].name)
    }
}

function processFile(file) {
    // Process the file here
    // For example, let's just read it as text
    var reader = new FileReader();
    reader.onload = function(e) {
        var contents = e.target.result;
        // Process contents here
        // The file contains XML. Import the XML to a DOM and then process it
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(contents, 'text/xml');
        var processedContents = processContents(xmlDoc);

        // Create a Blob with the processed contents
        var blob = new Blob([processedContents], {type: 'text/plain'});

        // Create a URL for the Blob
        var url = URL.createObjectURL(blob);

        // Set the href of the download link to the Blob URL and show the link
        var downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = 'processed_' + file.name;
        downloadLink.style.display = 'block';
    };
    reader.readAsText(file);
}

